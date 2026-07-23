import type { Prisma, UploadRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const uploadStatuses = ["PENDING", "PROCESSING", "COMPLETED", "PARTIAL", "FAILED"] as const;
const defaultPageSize = 10;
const exportLimit = 2_000;

type RawUploadTaskParams = Record<string, string | string[] | undefined>;

export type AdminUploadTaskFilters = {
  page: number;
  pageSize: number;
  status?: UploadRequestStatus;
  user?: string;
  spu?: string;
  onlyFailed?: boolean;
  from?: Date;
  to?: Date;
};

const uploadTaskInclude = {
  uploader: { select: { name: true, email: true } },
  assetGroup: { include: { product: true, category: true, channel: true } },
  assets: { include: { fileObject: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
  _count: { select: { assets: true } },
} satisfies Prisma.UploadRequestInclude;

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

function isUploadStatus(value: string | undefined): value is UploadRequestStatus {
  return uploadStatuses.includes(value as UploadRequestStatus);
}

export function parseAdminUploadTaskFilters(params: RawUploadTaskParams): AdminUploadTaskFilters {
  const status = firstValue(params.uploadStatus);
  return {
    page: parsePositiveInteger(firstValue(params.uploadPage), 1),
    pageSize: Math.min(parsePositiveInteger(firstValue(params.uploadPageSize), defaultPageSize), 50),
    status: isUploadStatus(status) ? status : undefined,
    user: firstValue(params.uploadUser)?.trim() || undefined,
    spu: firstValue(params.uploadSpu)?.trim() || undefined,
    onlyFailed: firstValue(params.uploadOnlyFailed) === "1",
    from: parseDate(firstValue(params.uploadFrom), "start"),
    to: parseDate(firstValue(params.uploadTo), "end"),
  };
}

export function serializeUploadTaskFilters(filters: AdminUploadTaskFilters) {
  return {
    page: String(filters.page),
    pageSize: String(filters.pageSize),
    status: filters.status ?? "",
    user: filters.user ?? "",
    spu: filters.spu ?? "",
    onlyFailed: filters.onlyFailed ? "1" : "",
    from: filters.from ? filters.from.toISOString().slice(0, 10) : "",
    to: filters.to ? filters.to.toISOString().slice(0, 10) : "",
  };
}

function uploadTaskWhere(filters: AdminUploadTaskFilters): Prisma.UploadRequestWhereInput {
  return {
    status: filters.status,
    createdAt: filters.from || filters.to ? { gte: filters.from, lte: filters.to } : undefined,
    uploader: filters.user ? { OR: [{ name: { contains: filters.user, mode: "insensitive" } }, { email: { contains: filters.user, mode: "insensitive" } }] } : undefined,
    assetGroup: filters.spu ? { product: { spu: { contains: filters.spu, mode: "insensitive" } } } : undefined,
    assets: filters.onlyFailed ? { some: { status: "FAILED" } } : undefined,
  };
}

function compactDateTime(value: Date | null) {
  return value ? value.toLocaleString("zh-CN", { hour12: false }) : "-";
}

function mapUploadTask(request: Prisma.UploadRequestGetPayload<{ include: typeof uploadTaskInclude }>) {
  return {
    id: request.id,
    uploader: request.uploader.name,
    email: request.uploader.email,
    status: request.status,
    spu: request.assetGroup.product.spu,
    category: request.assetGroup.category.name,
    categoryId: request.assetGroup.categoryId,
    channel: request.assetGroup.channel.name,
    channelId: request.assetGroup.channelId,
    countryCode: request.assetGroup.countryCode,
    assetType: request.assetGroup.assetType,
    assetCount: request._count.assets,
    activeCount: request.assets.filter((asset) => asset.status === "ACTIVE").length,
    failedCount: request.assets.filter((asset) => asset.status === "FAILED").length,
    createdAt: compactDateTime(request.createdAt),
    completedAt: compactDateTime(request.completedAt),
    libraryUrl: `/?channelId=${encodeURIComponent(request.assetGroup.channelId)}&categoryId=${encodeURIComponent(request.assetGroup.categoryId)}&spu=${encodeURIComponent(request.assetGroup.product.spu)}&page=1`,
    uploadUrl: `/upload?assetGroupId=${encodeURIComponent(request.assetGroupId)}`,
    assets: request.assets.map((asset) => ({
      id: asset.id,
      filename: asset.filename,
      originalFilename: asset.originalFilename,
      status: asset.status,
      errorCode: asset.errorCode ?? "-",
      errorMessage: asset.errorMessage ?? "-",
      assetType: asset.assetType,
      color: asset.color,
      sortOrder: asset.sortOrder,
      width: asset.fileObject.width,
      height: asset.fileObject.height,
      fileSizeBytes: asset.fileObject.fileSizeBytes,
      createdAt: compactDateTime(asset.createdAt),
    })),
  };
}

export async function listAdminUploadTasks(filters: AdminUploadTaskFilters) {
  const where = uploadTaskWhere(filters);
  const [items, total] = await prisma.$transaction([
    prisma.uploadRequest.findMany({ where, include: uploadTaskInclude, orderBy: { createdAt: "desc" }, skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize }),
    prisma.uploadRequest.count({ where }),
  ]);
  return {
    items: items.map(mapUploadTask),
    page: filters.page,
    pageSize: filters.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    filters: serializeUploadTaskFilters(filters),
    options: { statuses: uploadStatuses },
  };
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function exportAdminUploadTasksCsv(filters: AdminUploadTaskFilters) {
  const requests = await prisma.uploadRequest.findMany({ where: uploadTaskWhere({ ...filters, page: 1, pageSize: exportLimit }), include: uploadTaskInclude, orderBy: { createdAt: "desc" }, take: exportLimit });
  const header = ["上传批次ID", "批次状态", "上传人", "邮箱", "SPU", "品类", "渠道", "国家", "图片类型", "创建时间", "完成时间", "素材状态", "文件名", "原始文件名", "其他", "排序", "尺寸", "大小", "错误码", "错误信息"];
  const rows = requests.flatMap((request) => {
    const mapped = mapUploadTask(request);
    const assets = filters.onlyFailed ? mapped.assets.filter((asset) => asset.status === "FAILED") : mapped.assets;
    const rowsForRequest = assets.length ? assets : [{ status: "-", filename: "-", originalFilename: "-", color: "-", sortOrder: "-", width: "-", height: "-", fileSizeBytes: "-", errorCode: "-", errorMessage: "-" }];
    return rowsForRequest.map((asset) => [mapped.id, mapped.status, mapped.uploader, mapped.email, mapped.spu, mapped.category, mapped.channel, mapped.countryCode, mapped.assetType, mapped.createdAt, mapped.completedAt, asset.status, asset.filename, asset.originalFilename, asset.color, asset.sortOrder, `${asset.width} x ${asset.height}`, asset.fileSizeBytes, asset.errorCode, asset.errorMessage]);
  });
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export type AdminUploadTaskResult = Awaited<ReturnType<typeof listAdminUploadTasks>>;
