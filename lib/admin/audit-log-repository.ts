import { AuditAction, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const defaultPageSize = 15;
const exportLimit = 5_000;

type RawAuditLogParams = Record<string, string | string[] | undefined>;

export type AdminAuditLogFilters = {
  page: number;
  pageSize: number;
  action?: AuditAction;
  actor?: string;
  objectType?: string;
  objectId?: string;
  from?: Date;
  to?: Date;
};

const auditLogInclude = {
  actor: { select: { name: true, email: true } },
  asset: { include: { assetGroup: { include: { product: true, category: true, channel: true } } } },
} satisfies Prisma.AuditLogInclude;

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

function isAuditAction(value: string | undefined): value is AuditAction {
  return Object.values(AuditAction).includes(value as AuditAction);
}

export function parseAdminAuditLogFilters(params: RawAuditLogParams): AdminAuditLogFilters {
  const action = firstValue(params.auditAction);
  return {
    page: parsePositiveInteger(firstValue(params.auditPage), 1),
    pageSize: Math.min(parsePositiveInteger(firstValue(params.auditPageSize), defaultPageSize), 50),
    action: isAuditAction(action) ? action : undefined,
    actor: firstValue(params.auditActor)?.trim() || undefined,
    objectType: firstValue(params.auditObjectType)?.trim() || undefined,
    objectId: firstValue(params.auditObjectId)?.trim() || undefined,
    from: parseDate(firstValue(params.auditFrom), "start"),
    to: parseDate(firstValue(params.auditTo), "end"),
  };
}

export function serializeAuditLogFilters(filters: AdminAuditLogFilters) {
  return {
    page: String(filters.page),
    pageSize: String(filters.pageSize),
    action: filters.action ?? "",
    actor: filters.actor ?? "",
    objectType: filters.objectType ?? "",
    objectId: filters.objectId ?? "",
    from: filters.from ? filters.from.toISOString().slice(0, 10) : "",
    to: filters.to ? filters.to.toISOString().slice(0, 10) : "",
  };
}

function auditLogWhere(filters: AdminAuditLogFilters): Prisma.AuditLogWhereInput {
  return {
    action: filters.action,
    objectType: filters.objectType,
    objectId: filters.objectId ? { contains: filters.objectId, mode: "insensitive" } : undefined,
    createdAt: filters.from || filters.to ? { gte: filters.from, lte: filters.to } : undefined,
    actor: filters.actor ? { OR: [{ name: { contains: filters.actor, mode: "insensitive" } }, { email: { contains: filters.actor, mode: "insensitive" } }] } : undefined,
  };
}

function compactDateTime(value: Date | null) {
  return value ? value.toLocaleString("zh-CN", { hour12: false }) : "-";
}

function detailsText(details: Prisma.JsonValue | null) {
  if (details === null) return "-";
  return JSON.stringify(details, null, 2);
}

function mapAuditLog(log: Prisma.AuditLogGetPayload<{ include: typeof auditLogInclude }>) {
  return {
    id: log.id,
    action: log.action,
    objectType: log.objectType,
    objectId: log.objectId,
    actor: log.actor?.name ?? "系统",
    email: log.actor?.email ?? "-",
    createdAt: compactDateTime(log.createdAt),
    details: detailsText(log.details),
    asset: log.asset ? {
      filename: log.asset.filename,
      spu: log.asset.assetGroup.product.spu,
      category: log.asset.assetGroup.category.name,
      channel: log.asset.assetGroup.channel.name,
    } : null,
  };
}

export async function listAdminAuditLogs(filters: AdminAuditLogFilters) {
  const where = auditLogWhere(filters);
  const [items, total, objectTypes] = await prisma.$transaction([
    prisma.auditLog.findMany({ where, include: auditLogInclude, orderBy: { createdAt: "desc" }, skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ["objectType"], orderBy: { objectType: "asc" } }),
  ]);
  return {
    items: items.map(mapAuditLog),
    page: filters.page,
    pageSize: filters.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    filters: serializeAuditLogFilters(filters),
    options: {
      actions: Object.values(AuditAction),
      objectTypes: objectTypes.map((item) => item.objectType),
    },
  };
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function exportAdminAuditLogsCsv(filters: AdminAuditLogFilters) {
  const logs = await prisma.auditLog.findMany({ where: auditLogWhere({ ...filters, page: 1, pageSize: exportLimit }), include: auditLogInclude, orderBy: { createdAt: "desc" }, take: exportLimit });
  const header = ["日志ID", "时间", "操作", "对象类型", "对象ID", "操作者", "邮箱", "素材文件", "SPU", "品类", "渠道", "详情"];
  const rows = logs.map((log) => {
    const mapped = mapAuditLog(log);
    return [mapped.id, mapped.createdAt, mapped.action, mapped.objectType, mapped.objectId, mapped.actor, mapped.email, mapped.asset?.filename ?? "-", mapped.asset?.spu ?? "-", mapped.asset?.category ?? "-", mapped.asset?.channel ?? "-", mapped.details];
  });
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export type AdminAuditLogResult = Awaited<ReturnType<typeof listAdminAuditLogs>>;
