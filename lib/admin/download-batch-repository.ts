import type { DownloadBatchStatus, DownloadBatchType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const downloadBatchStatuses = ["PREPARED", "DOWNLOADED", "PARTIAL", "FAILED"] as const;
const downloadBatchTypes = ["ASSETS", "PRODUCTS"] as const;
const defaultPageSize = 10;
const exportLimit = 2_000;

type RawDownloadBatchParams = Record<string, string | string[] | undefined>;

export type AdminDownloadBatchFilters = {
  page: number;
  pageSize: number;
  status?: DownloadBatchStatus;
  type?: DownloadBatchType;
  user?: string;
  from?: Date;
  to?: Date;
};

const downloadBatchInclude = {
  actor: { select: { name: true, email: true } },
  items: { include: { asset: { include: { assetGroup: { include: { product: true, category: true, channel: true } } } } }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.DownloadBatchInclude;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseDate(value: string | undefined, boundary: "start" | "end") {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (boundary === "start") date.setHours(0, 0, 0, 0);
  else date.setHours(23, 59, 59, 999);
  return date;
}

function isDownloadBatchStatus(value: string | undefined): value is DownloadBatchStatus {
  return downloadBatchStatuses.includes(value as DownloadBatchStatus);
}

function isDownloadBatchType(value: string | undefined): value is DownloadBatchType {
  return downloadBatchTypes.includes(value as DownloadBatchType);
}

export function parseAdminDownloadBatchFilters(params: RawDownloadBatchParams): AdminDownloadBatchFilters {
  const status = firstValue(params.downloadStatus);
  const type = firstValue(params.downloadType);
  return {
    page: parsePositiveInteger(firstValue(params.downloadPage), 1),
    pageSize: Math.min(parsePositiveInteger(firstValue(params.downloadPageSize), defaultPageSize), 50),
    status: isDownloadBatchStatus(status) ? status : undefined,
    type: isDownloadBatchType(type) ? type : undefined,
    user: firstValue(params.downloadUser)?.trim() || undefined,
    from: parseDate(firstValue(params.downloadFrom), "start"),
    to: parseDate(firstValue(params.downloadTo), "end"),
  };
}

export function serializeDownloadBatchFilters(filters: AdminDownloadBatchFilters) {
  return {
    page: String(filters.page),
    pageSize: String(filters.pageSize),
    status: filters.status ?? "",
    type: filters.type ?? "",
    user: filters.user ?? "",
    from: filters.from ? filters.from.toISOString().slice(0, 10) : "",
    to: filters.to ? filters.to.toISOString().slice(0, 10) : "",
  };
}

function downloadBatchWhere(filters: AdminDownloadBatchFilters): Prisma.DownloadBatchWhereInput {
  return {
    status: filters.status,
    type: filters.type,
    preparedAt: filters.from || filters.to ? { gte: filters.from, lte: filters.to } : undefined,
    actor: filters.user ? { OR: [{ name: { contains: filters.user, mode: "insensitive" } }, { email: { contains: filters.user, mode: "insensitive" } }] } : undefined,
  };
}

function compactDateTime(value: Date | null) {
  return value ? value.toLocaleString("zh-CN", { hour12: false }) : "-";
}

function mapDownloadBatch(batch: Prisma.DownloadBatchGetPayload<{ include: typeof downloadBatchInclude }>) {
  return {
    id: batch.id,
    type: batch.type === "PRODUCTS" ? "素材库 ZIP" : "素材 ZIP",
    rawType: batch.type,
    status: batch.status,
    user: batch.actor?.name ?? "未知用户",
    email: batch.actor?.email ?? "-",
    requestedCount: batch.requestedCount,
    readyCount: batch.readyCount,
    failedCount: batch.failedCount,
    zipFilename: batch.zipFilename,
    ipAddress: batch.ipAddress ?? "-",
    userAgent: batch.userAgent ?? "-",
    preparedAt: compactDateTime(batch.preparedAt),
    downloadedAt: compactDateTime(batch.downloadedAt),
    items: batch.items.map((item) => ({
      id: item.id,
      status: item.status,
      filename: item.filename ?? item.asset?.filename ?? "-",
      archivePath: item.archivePath ?? "-",
      errorCode: item.errorCode ?? "-",
      spu: item.asset?.assetGroup.product.spu ?? "-",
      category: item.asset?.assetGroup.category.name ?? "-",
      channel: item.asset?.assetGroup.channel.name ?? "-",
    })),
  };
}

export async function listAdminDownloadBatches(filters: AdminDownloadBatchFilters) {
  const where = downloadBatchWhere(filters);
  const [items, total] = await prisma.$transaction([
    prisma.downloadBatch.findMany({ where, include: downloadBatchInclude, orderBy: { preparedAt: "desc" }, skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize }),
    prisma.downloadBatch.count({ where }),
  ]);
  return {
    items: items.map(mapDownloadBatch),
    page: filters.page,
    pageSize: filters.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    filters: serializeDownloadBatchFilters(filters),
  };
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function exportAdminDownloadBatchesCsv(filters: AdminDownloadBatchFilters) {
  const batches = await prisma.downloadBatch.findMany({ where: downloadBatchWhere({ ...filters, page: 1, pageSize: exportLimit }), include: downloadBatchInclude, orderBy: { preparedAt: "desc" }, take: exportLimit });
  const header = ["批次ID", "类型", "状态", "用户", "邮箱", "ZIP文件", "准备时间", "下载时间", "IP", "User-Agent", "请求数", "成功数", "失败数", "素材状态", "素材文件", "ZIP路径", "SPU", "品类", "渠道", "错误码"];
  const rows = batches.flatMap((batch) => {
    const mapped = mapDownloadBatch(batch);
    const items = mapped.items.length ? mapped.items : [{ id: "", status: "-", filename: "-", archivePath: "-", errorCode: "-", spu: "-", category: "-", channel: "-" }];
    return items.map((item) => [mapped.id, mapped.type, mapped.status, mapped.user, mapped.email, mapped.zipFilename, mapped.preparedAt, mapped.downloadedAt, mapped.ipAddress, mapped.userAgent, mapped.requestedCount, mapped.readyCount, mapped.failedCount, item.status, item.filename, item.archivePath, item.spu, item.category, item.channel, item.errorCode]);
  });
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}
