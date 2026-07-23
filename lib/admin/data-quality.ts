import type { AssetStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assetTypeOptions, countryName, countryOptions } from "@/lib/library/countries";

const defaultPageSize = 12;
const scanLimit = 2_000;
const exportLimit = 5_000;

const issueTypes = ["spu", "asset-group", "filename", "derivative", "dimension", "duplicate", "sort", "failed"] as const;
const severities = ["ERROR", "WARN", "INFO"] as const;

type IssueType = (typeof issueTypes)[number];
type Severity = (typeof severities)[number];
type RawDataQualityParams = Record<string, string | string[] | undefined>;

type DataQualityIssue = {
  id: string;
  type: IssueType;
  typeLabel: string;
  severity: Severity;
  target: string;
  spu: string;
  category: string;
  channel: string;
  country: string;
  assetType: string;
  filename: string;
  message: string;
  updatedAt: string;
  libraryUrl: string;
};

export type AdminDataQualityFilters = {
  page: number;
  pageSize: number;
  type?: IssueType;
  severity?: Severity;
  search?: string;
};

const typeLabels: Record<IssueType, string> = {
  spu: "SPU 命名",
  "asset-group": "素材组字段",
  filename: "文件名规范",
  derivative: "派生图缺失",
  dimension: "尺寸异常",
  duplicate: "重复图片",
  sort: "排序冲突",
  failed: "处理失败",
};

const assetInclude = {
  assetGroup: { include: { product: true, category: true, channel: true } },
  fileObject: true,
} satisfies Prisma.AssetInclude;

type AssetWithQualityRelations = Prisma.AssetGetPayload<{ include: typeof assetInclude }>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function compactDateTime(value: Date | null) {
  return value ? value.toLocaleString("zh-CN", { hour12: false }) : "-";
}

function isIssueType(value: string | undefined): value is IssueType {
  return issueTypes.includes(value as IssueType);
}

function isSeverity(value: string | undefined): value is Severity {
  return severities.includes(value as Severity);
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function libraryUrl(asset: AssetWithQualityRelations) {
  return `/?channelId=${encodeURIComponent(asset.assetGroup.channelId)}&categoryId=${encodeURIComponent(asset.assetGroup.categoryId)}&spu=${encodeURIComponent(asset.assetGroup.product.spu)}&page=1`;
}

function issueFromAsset(asset: AssetWithQualityRelations, type: IssueType, severity: Severity, message: string, suffix: string): DataQualityIssue {
  return {
    id: `${type}-${asset.id}-${suffix}`,
    type,
    typeLabel: typeLabels[type],
    severity,
    target: asset.id,
    spu: asset.assetGroup.product.spu,
    category: asset.assetGroup.category.name,
    channel: asset.assetGroup.channel.name,
    country: countryName(asset.assetGroup.countryCode),
    assetType: asset.assetType,
    filename: asset.filename,
    message,
    updatedAt: compactDateTime(asset.updatedAt),
    libraryUrl: libraryUrl(asset),
  };
}

function normalizedFilename(value: string) {
  return value.toLowerCase().replace(/\s+/g, "_");
}

function filenameLooksComplete(asset: AssetWithQualityRelations) {
  const filename = normalizedFilename(asset.filename);
  return filename.includes(asset.assetGroup.product.spu.toLowerCase()) && filename.includes(countryName(asset.assetGroup.countryCode).toLowerCase()) && filename.includes(asset.assetType.toLowerCase());
}

function matchesSearch(issue: DataQualityIssue, search: string) {
  const keyword = search.toLowerCase();
  return [issue.spu, issue.filename, issue.message, issue.category, issue.channel, issue.country, issue.assetType].some((value) => value.toLowerCase().includes(keyword));
}

function applyFilters(issues: DataQualityIssue[], filters: AdminDataQualityFilters) {
  return issues.filter((issue) => {
    if (filters.type && issue.type !== filters.type) return false;
    if (filters.severity && issue.severity !== filters.severity) return false;
    if (filters.search && !matchesSearch(issue, filters.search)) return false;
    return true;
  });
}

function issueSort(left: DataQualityIssue, right: DataQualityIssue) {
  const severityOrder: Record<Severity, number> = { ERROR: 0, WARN: 1, INFO: 2 };
  return severityOrder[left.severity] - severityOrder[right.severity] || left.typeLabel.localeCompare(right.typeLabel, "zh-CN") || right.updatedAt.localeCompare(left.updatedAt);
}

export function parseAdminDataQualityFilters(params: RawDataQualityParams): AdminDataQualityFilters {
  const type = firstValue(params.qualityType);
  const severity = firstValue(params.qualitySeverity);
  return {
    page: parsePositiveInteger(firstValue(params.qualityPage), 1),
    pageSize: Math.min(parsePositiveInteger(firstValue(params.qualityPageSize), defaultPageSize), 50),
    type: isIssueType(type) ? type : undefined,
    severity: isSeverity(severity) ? severity : undefined,
    search: firstValue(params.qualitySearch)?.trim() || undefined,
  };
}

export function serializeDataQualityFilters(filters: AdminDataQualityFilters) {
  return {
    page: String(filters.page),
    pageSize: String(filters.pageSize),
    type: filters.type ?? "",
    severity: filters.severity ?? "",
    search: filters.search ?? "",
  };
}

async function collectDataQualityIssues() {
  const [products, assetGroups, assets, duplicateFileObjects] = await prisma.$transaction([
    prisma.product.findMany({ include: { category: true }, orderBy: { updatedAt: "desc" }, take: scanLimit }),
    prisma.assetGroup.findMany({ include: { product: true, category: true, channel: true, _count: { select: { assets: { where: { status: "ACTIVE" } } } } }, orderBy: { updatedAt: "desc" }, take: scanLimit }),
    prisma.asset.findMany({ where: { status: { in: ["ACTIVE", "FAILED"] } }, include: assetInclude, orderBy: { updatedAt: "desc" }, take: scanLimit }),
    prisma.asset.groupBy({ by: ["fileObjectId"], where: { status: "ACTIVE" }, _count: { _all: true }, having: { fileObjectId: { _count: { gt: 1 } } }, orderBy: { _count: { fileObjectId: "desc" } }, take: 50 }),
  ]);

  const issues: DataQualityIssue[] = [];
  const knownCountries = new Set<string>(countryOptions.map((country) => country.code));
  const knownAssetTypes = new Set<string>(assetTypeOptions);

  for (const product of products) {
    if (/\s/.test(product.spu) || /[\\/:*?"<>|]/.test(product.spu)) {
      issues.push({ id: `spu-${product.id}`, type: "spu", typeLabel: typeLabels.spu, severity: "WARN", target: product.id, spu: product.spu, category: product.category.name, channel: "-", country: "-", assetType: "-", filename: "-", message: "SPU 包含空格或文件名不安全字符，可能影响搜索和 ZIP 文件名。", updatedAt: compactDateTime(product.updatedAt), libraryUrl: `/?categoryId=${encodeURIComponent(product.categoryId)}&spu=${encodeURIComponent(product.spu)}&page=1` });
    }
  }

  for (const group of assetGroups) {
    if (!knownCountries.has(group.countryCode)) {
      issues.push({ id: `country-${group.id}`, type: "asset-group", typeLabel: typeLabels["asset-group"], severity: "ERROR", target: group.id, spu: group.product.spu, category: group.category.name, channel: group.channel.name, country: group.countryCode, assetType: group.assetType, filename: "-", message: "素材组国家不在当前国家策略列表中。", updatedAt: compactDateTime(group.updatedAt), libraryUrl: `/?channelId=${encodeURIComponent(group.channelId)}&categoryId=${encodeURIComponent(group.categoryId)}&spu=${encodeURIComponent(group.product.spu)}&page=1` });
    }
    if (!knownAssetTypes.has(group.assetType)) {
      issues.push({ id: `asset-type-${group.id}`, type: "asset-group", typeLabel: typeLabels["asset-group"], severity: "WARN", target: group.id, spu: group.product.spu, category: group.category.name, channel: group.channel.name, country: countryName(group.countryCode), assetType: group.assetType, filename: "-", message: "素材组图片类型不在当前图片类型策略列表中。", updatedAt: compactDateTime(group.updatedAt), libraryUrl: `/?channelId=${encodeURIComponent(group.channelId)}&categoryId=${encodeURIComponent(group.categoryId)}&spu=${encodeURIComponent(group.product.spu)}&page=1` });
    }
  }

  for (const asset of assets) {
    if (asset.status === "FAILED") {
      issues.push(issueFromAsset(asset, "failed", "ERROR", asset.errorMessage ?? "素材处理失败。", "failed"));
      continue;
    }
    if (!asset.fileObject.originalStorageKey || !asset.fileObject.thumbnailStorageKey || !asset.fileObject.previewStorageKey) {
      issues.push(issueFromAsset(asset, "derivative", !asset.fileObject.originalStorageKey ? "ERROR" : "WARN", "原图、缩略图或预览图存储 key 缺失。", "derivative"));
    }
    if (asset.fileObject.width <= 0 || asset.fileObject.height <= 0) {
      issues.push(issueFromAsset(asset, "dimension", "ERROR", "图片宽高为 0，可能是处理过程异常。", "zero-size"));
    } else if (asset.fileObject.width < 600 || asset.fileObject.height < 600) {
      issues.push(issueFromAsset(asset, "dimension", "WARN", `图片尺寸偏小：${asset.fileObject.width} x ${asset.fileObject.height}。`, "small-size"));
    }
    if (!filenameLooksComplete(asset)) {
      issues.push(issueFromAsset(asset, "filename", "WARN", "文件名未同时包含 SPU、国家和图片类型，可能不符合当前命名规范。", "filename"));
    }
    if (asset.assetType !== asset.assetGroup.assetType) {
      issues.push(issueFromAsset(asset, "asset-group", "ERROR", "素材图片类型与所属素材组图片类型不一致。", "asset-type-mismatch"));
    }
  }

  const assetsByGroupAndOrder = new Map<string, AssetWithQualityRelations[]>();
  for (const asset of assets.filter((item) => item.status === "ACTIVE" as AssetStatus)) {
    const key = `${asset.assetGroupId}:${asset.sortOrder}`;
    assetsByGroupAndOrder.set(key, [...(assetsByGroupAndOrder.get(key) ?? []), asset]);
  }
  for (const duplicated of assetsByGroupAndOrder.values()) {
    if (duplicated.length > 1) {
      const sample = duplicated[0];
      issues.push(issueFromAsset(sample, "sort", "WARN", `同一素材组内排序 ${sample.sortOrder} 被 ${duplicated.length} 个素材共用。`, "sort"));
    }
  }

  const duplicateIds = new Set(duplicateFileObjects.map((item) => item.fileObjectId));
  const duplicateAssets = assets.filter((asset) => duplicateIds.has(asset.fileObjectId) && asset.status === "ACTIVE");
  const firstByFileObject = new Map<string, AssetWithQualityRelations>();
  for (const asset of duplicateAssets) if (!firstByFileObject.has(asset.fileObjectId)) firstByFileObject.set(asset.fileObjectId, asset);
  for (const duplicate of duplicateFileObjects) {
    const sample = firstByFileObject.get(duplicate.fileObjectId);
    if (sample) issues.push(issueFromAsset(sample, "duplicate", "INFO", `同一图片文件被 ${duplicate._count._all} 个有效素材复用。`, "duplicate"));
  }

  return issues.sort(issueSort);
}

export async function listAdminDataQuality(filters: AdminDataQualityFilters) {
  const issues = await collectDataQualityIssues();
  const filtered = applyFilters(issues, filters);
  const summary = {
    total: issues.length,
    errors: issues.filter((issue) => issue.severity === "ERROR").length,
    warnings: issues.filter((issue) => issue.severity === "WARN").length,
    info: issues.filter((issue) => issue.severity === "INFO").length,
  };
  return {
    items: filtered.slice((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize),
    page: filters.page,
    pageSize: filters.pageSize,
    total: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / filters.pageSize)),
    summary,
    filters: serializeDataQualityFilters(filters),
    options: { types: issueTypes.map((type) => ({ value: type, label: typeLabels[type] })), severities },
  };
}

export async function exportAdminDataQualityCsv(filters: AdminDataQualityFilters) {
  const quality = await listAdminDataQuality({ ...filters, page: 1, pageSize: exportLimit });
  const header = ["严重级别", "类型", "SPU", "品类", "渠道", "国家", "图片类型", "文件名", "问题说明", "更新时间", "对象ID"];
  const rows = quality.items.map((issue) => [issue.severity, issue.typeLabel, issue.spu, issue.category, issue.channel, issue.country, issue.assetType, issue.filename, issue.message, issue.updatedAt, issue.target]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export type AdminDataQualityResult = Awaited<ReturnType<typeof listAdminDataQuality>>;
