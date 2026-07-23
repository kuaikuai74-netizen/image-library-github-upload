import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assetTypeOptions, countryName, countryOptions } from "@/lib/library/countries";

const defaultPageSize = 10;
const exportLimit = 2_000;

type RawAssetGroupGovernanceParams = Record<string, string | string[] | undefined>;

export type AdminAssetGroupGovernanceFilters = {
  page: number;
  pageSize: number;
  search?: string;
  categoryId?: string;
  missingCountry?: (typeof countryOptions)[number]["code"];
  missingAssetType?: (typeof assetTypeOptions)[number];
  issue?: "incomplete" | "failed" | "empty";
};

function compactDateTime(value: Date | null) {
  return value ? value.toLocaleString("zh-CN", { hour12: false }) : "-";
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isKnownCountryCode(value: string | undefined): value is (typeof countryOptions)[number]["code"] {
  return countryOptions.some((country) => country.code === value);
}

function isKnownAssetType(value: string | undefined): value is (typeof assetTypeOptions)[number] {
  return assetTypeOptions.some((assetType) => assetType === value);
}

function isKnownIssue(value: string | undefined): value is AdminAssetGroupGovernanceFilters["issue"] {
  return value === "incomplete" || value === "failed" || value === "empty";
}

export function parseAdminAssetGroupGovernanceFilters(params: RawAssetGroupGovernanceParams): AdminAssetGroupGovernanceFilters {
  const missingCountry = firstValue(params.governanceMissingCountry);
  const missingAssetType = firstValue(params.governanceMissingAssetType);
  const issue = firstValue(params.governanceIssue);
  return {
    page: parsePositiveInteger(firstValue(params.governancePage), 1),
    pageSize: Math.min(parsePositiveInteger(firstValue(params.governancePageSize), defaultPageSize), 50),
    search: firstValue(params.governanceSearch)?.trim() || undefined,
    categoryId: firstValue(params.governanceCategoryId)?.trim() || undefined,
    missingCountry: isKnownCountryCode(missingCountry) ? missingCountry : undefined,
    missingAssetType: isKnownAssetType(missingAssetType) ? missingAssetType : undefined,
    issue: isKnownIssue(issue) ? issue : undefined,
  };
}

export function serializeAssetGroupGovernanceFilters(filters: AdminAssetGroupGovernanceFilters) {
  return {
    page: String(filters.page),
    pageSize: String(filters.pageSize),
    search: filters.search ?? "",
    categoryId: filters.categoryId ?? "",
    missingCountry: filters.missingCountry ?? "",
    missingAssetType: filters.missingAssetType ?? "",
    issue: filters.issue ?? "",
  };
}

function productWhere(filters: AdminAssetGroupGovernanceFilters): Prisma.ProductWhereInput {
  return {
    categoryId: filters.categoryId,
    OR: filters.search
      ? [
          { spu: { contains: filters.search, mode: "insensitive" } },
          { name: { contains: filters.search, mode: "insensitive" } },
        ]
      : undefined,
  };
}

const productInclude = {
  category: { select: { id: true, name: true } },
  assetGroups: {
    include: {
      channel: { select: { name: true } },
      category: { select: { name: true } },
      _count: { select: { assets: { where: { status: "ACTIVE" } } } },
      assets: { select: { status: true, updatedAt: true }, orderBy: { updatedAt: "desc" } },
    },
    orderBy: [{ channel: { name: "asc" } }, { countryCode: "asc" }, { assetType: "asc" }],
  },
} satisfies Prisma.ProductInclude;

function mapProductCoverage(product: Prisma.ProductGetPayload<{ include: typeof productInclude }>) {
  const requiredCountryCodes = countryOptions.map((country) => country.code);
  const requiredAssetTypes = [...assetTypeOptions];
  const activeGroups = product.assetGroups.filter((group) => group._count.assets > 0);
  const coveredCountries = new Set(activeGroups.map((group) => group.countryCode));
  const coveredAssetTypes = new Set(activeGroups.map((group) => group.assetType));
  const failedAssets = product.assetGroups.reduce((total, group) => total + group.assets.filter((asset) => asset.status === "FAILED").length, 0);
  const assetCount = product.assetGroups.reduce((total, group) => total + group._count.assets, 0);
  const missingCountries = requiredCountryCodes.filter((countryCode) => !coveredCountries.has(countryCode));
  const missingAssetTypes = requiredAssetTypes.filter((assetType) => !coveredAssetTypes.has(assetType));
  const lastUpdated = product.assetGroups.flatMap((group) => [group.updatedAt, ...group.assets.map((asset) => asset.updatedAt)]).sort((left, right) => right.getTime() - left.getTime())[0] ?? product.updatedAt;
  return {
    id: product.id,
    spu: product.spu,
    name: product.name,
    category: product.category.name,
    groupCount: product.assetGroups.length,
    activeGroupCount: activeGroups.length,
    assetCount,
    failedAssetCount: failedAssets,
    countryCoverage: `${coveredCountries.size}/${requiredCountryCodes.length}`,
    assetTypeCoverage: `${coveredAssetTypes.size}/${requiredAssetTypes.length}`,
    missingCountryCodes: missingCountries,
    missingCountries: missingCountries.map(countryName),
    missingAssetTypes,
    updatedAt: compactDateTime(lastUpdated),
    groups: product.assetGroups.map((group) => ({
      id: group.id,
      channel: group.channel.name,
      category: group.category.name,
      country: countryName(group.countryCode),
      assetType: group.assetType,
      assetCount: group._count.assets,
      failedAssetCount: group.assets.filter((asset) => asset.status === "FAILED").length,
      updatedAt: compactDateTime(group.updatedAt),
    })),
  };
}

function matchesIssue(product: ReturnType<typeof mapProductCoverage>, filters: AdminAssetGroupGovernanceFilters) {
  if (filters.missingCountry && !product.missingCountryCodes.includes(filters.missingCountry)) return false;
  if (filters.missingAssetType && !product.missingAssetTypes.includes(filters.missingAssetType)) return false;
  if (filters.issue === "incomplete") return product.missingCountries.length > 0 || product.missingAssetTypes.length > 0;
  if (filters.issue === "failed") return product.failedAssetCount > 0;
  if (filters.issue === "empty") return product.assetCount === 0;
  return true;
}

export async function listAdminAssetGroupCoverage(filters: AdminAssetGroupGovernanceFilters) {
  const [products, categories] = await prisma.$transaction([
    prisma.product.findMany({
      where: productWhere(filters),
      include: productInclude,
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);

  const filtered = products.map(mapProductCoverage).filter((product) => matchesIssue(product, filters));
  const total = filtered.length;
  const pageItems = filtered.slice((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize);
  return {
    items: pageItems,
    page: filters.page,
    pageSize: filters.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    filters: serializeAssetGroupGovernanceFilters(filters),
    options: {
      categories,
      countries: countryOptions,
      assetTypes: assetTypeOptions,
    },
  };
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function exportAdminAssetGroupGovernanceCsv(filters: AdminAssetGroupGovernanceFilters) {
  const coverage = await listAdminAssetGroupCoverage({ ...filters, page: 1, pageSize: exportLimit });
  const header = ["SPU", "名称", "品类", "有效素材数", "素材组", "失败素材", "国家覆盖", "类型覆盖", "缺少国家", "缺少图片类型", "素材组渠道", "素材组国家", "素材组图片类型", "素材组有效素材数", "素材组失败素材数", "素材组更新时间"];
  const rows = coverage.items.flatMap((product) => {
    const groups = product.groups.length ? product.groups : [{ channel: "-", country: "-", assetType: "-", assetCount: 0, failedAssetCount: 0, updatedAt: "-" }];
    return groups.map((group) => [product.spu, product.name, product.category, product.assetCount, `${product.activeGroupCount}/${product.groupCount}`, product.failedAssetCount, product.countryCoverage, product.assetTypeCoverage, product.missingCountries.join("、") || "无", product.missingAssetTypes.join("、") || "无", group.channel, group.country, group.assetType, group.assetCount, group.failedAssetCount, group.updatedAt]);
  });
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export type AdminAssetGroupCoverageResult = Awaited<ReturnType<typeof listAdminAssetGroupCoverage>>;
export type AdminAssetGroupCoverage = AdminAssetGroupCoverageResult["items"][number];
