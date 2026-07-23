import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { roleLabels, userRoles, type UserRole } from "@/lib/auth/roles";

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function compactDateTime(value: Date | null) {
  return value ? value.toLocaleString("zh-CN", { hour12: false }) : "-";
}

function dateTimeInput(value: Date | null) {
  if (!value) return "";
  const offsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}

function normalizeRoles(roles: string[]) {
  return roles.filter((role): role is UserRole => userRoles.includes(role as UserRole));
}

export async function getAdminOverview() {
  const since = startOfToday();
  const [assetTotal, productTotal, activeUsers, uploadToday, downloadToday, cleanupPending, storageUsage, recentDownloads, users, recentUploads, topDownloadActors, roleCounts, uploadStatusCounts, assetTypeCounts, categoryGroups, channelGroups, recentAdminActions, announcementStatusCounts, documentStatusCounts, announcements, documentPages] = await prisma.$transaction([
    prisma.asset.count({ where: { status: "ACTIVE" } }),
    prisma.product.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.asset.count({ where: { status: "ACTIVE", createdAt: { gte: since } } }),
    prisma.auditLog.count({ where: { action: { in: ["ASSET_DOWNLOADED", "BATCH_DOWNLOAD_REQUESTED"] }, createdAt: { gte: since } } }),
    prisma.fileObject.count({ where: { cleanupStatus: "PENDING" } }),
    prisma.fileObject.aggregate({ where: { status: "ACTIVE" }, _sum: { fileSizeBytes: true } }),
    prisma.auditLog.findMany({
      where: { action: { in: ["ASSET_DOWNLOADED", "BATCH_DOWNLOAD_REQUESTED"] } },
      include: {
        actor: { select: { name: true, email: true } },
        asset: { include: { assetGroup: { include: { product: true, category: true, channel: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        status: true,
        createdAt: true,
        _count: { select: { uploadedAssets: true, auditLogs: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.uploadRequest.findMany({
      include: { uploader: { select: { name: true, email: true } }, assetGroup: { include: { product: true, category: true, channel: true } }, _count: { select: { assets: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.auditLog.groupBy({
      by: ["actorId"],
      where: { action: { in: ["ASSET_DOWNLOADED", "BATCH_DOWNLOAD_REQUESTED"] }, actorId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { actorId: "desc" } },
      take: 8,
    }),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true }, orderBy: { role: "asc" } }),
    prisma.uploadRequest.groupBy({ by: ["status"], _count: { _all: true }, orderBy: { status: "asc" } }),
    prisma.asset.groupBy({ by: ["assetType"], where: { status: "ACTIVE" }, _count: { _all: true }, orderBy: { _count: { assetType: "desc" } }, take: 6 }),
    prisma.assetGroup.findMany({ select: { category: { select: { name: true } }, _count: { select: { assets: { where: { status: "ACTIVE" } } } } } }),
    prisma.assetGroup.findMany({ select: { channel: { select: { name: true } }, _count: { select: { assets: { where: { status: "ACTIVE" } } } } } }),
    prisma.auditLog.findMany({ include: { actor: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.announcement.groupBy({ by: ["status"], _count: { _all: true }, orderBy: { status: "asc" } }),
    prisma.documentPage.groupBy({ by: ["status"], _count: { _all: true }, orderBy: { status: "asc" } }),
    prisma.announcement.findMany({ include: { createdBy: { select: { name: true, email: true } }, _count: { select: { reads: true } } }, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 20 }),
    prisma.documentPage.findMany({ include: { createdBy: { select: { name: true, email: true } } }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }], take: 30 }),
  ]);

  const actorIds = topDownloadActors.map((item) => item.actorId).filter((actorId): actorId is string => Boolean(actorId));
  const downloadActors = await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } });
  const actorById = new Map(downloadActors.map((actor) => [actor.id, actor]));
  const categoryTotals = summarizeNamedCounts(categoryGroups.map((group) => ({ name: group.category.name, count: group._count.assets }))).slice(0, 8);
  const channelTotals = summarizeNamedCounts(channelGroups.map((group) => ({ name: group.channel.name, count: group._count.assets }))).slice(0, 8);

  return {
    metrics: {
      assetTotal,
      productTotal,
      activeUsers,
      uploadToday,
      downloadToday,
      cleanupPending,
      storageBytes: storageUsage._sum.fileSizeBytes ?? 0,
      publishedAnnouncements: announcementStatusCounts.find((item) => item.status === "PUBLISHED")?._count._all ?? 0,
      publishedDocuments: documentStatusCounts.find((item) => item.status === "PUBLISHED")?._count._all ?? 0,
    },
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      roleLabel: roleLabels[user.role],
      status: user.status,
      uploadedAssets: user._count.uploadedAssets,
      auditLogs: user._count.auditLogs,
      createdAt: compactDateTime(user.createdAt),
    })),
    recentDownloads: recentDownloads.map((log) => ({
      id: log.id,
      user: log.actor?.name ?? "未知用户",
      email: log.actor?.email ?? "-",
      action: log.action === "ASSET_DOWNLOADED" ? "单图下载" : "批量下载",
      filename: log.asset?.filename ?? "批量记录",
      spu: log.asset?.assetGroup.product.spu ?? "-",
      category: log.asset?.assetGroup.category.name ?? "-",
      channel: log.asset?.assetGroup.channel.name ?? "-",
      createdAt: compactDateTime(log.createdAt),
    })),
    recentUploads: recentUploads.map((request) => ({
      id: request.id,
      uploader: request.uploader.name,
      email: request.uploader.email,
      status: request.status,
      spu: request.assetGroup.product.spu,
      category: request.assetGroup.category.name,
      channel: request.assetGroup.channel.name,
      assetCount: request._count.assets,
      createdAt: compactDateTime(request.createdAt),
      completedAt: compactDateTime(request.completedAt),
    })),
    topDownloadUsers: topDownloadActors.map((item) => {
      const actor = actorById.get(item.actorId ?? "");
      return { id: item.actorId ?? "unknown", name: actor?.name ?? "未知用户", email: actor?.email ?? "-", downloads: item._count._all };
    }),
    roleCounts: roleCounts.map((item) => ({ role: item.role, label: roleLabels[item.role], count: item._count._all })),
    uploadStatusCounts: uploadStatusCounts.map((item) => ({ status: item.status, count: item._count._all })),
    assetTypeCounts: assetTypeCounts.map((item) => ({ assetType: item.assetType, count: item._count._all })),
    categoryTotals,
    channelTotals,
    announcementStatusCounts: announcementStatusCounts.map((item) => ({ status: item.status, count: item._count._all })),
    documentStatusCounts: documentStatusCounts.map((item) => ({ status: item.status, count: item._count._all })),
    announcements: announcements.map((announcement) => ({ id: announcement.id, title: announcement.title, body: announcement.body, type: announcement.type, status: announcement.status, visibilityRoles: normalizeRoles(announcement.visibilityRoles), pinned: announcement.pinned, startsAt: compactDateTime(announcement.startsAt), endsAt: compactDateTime(announcement.endsAt), startsAtInput: dateTimeInput(announcement.startsAt), endsAtInput: dateTimeInput(announcement.endsAt), readCount: announcement._count.reads, createdBy: announcement.createdBy?.name ?? "系统", createdAt: compactDateTime(announcement.createdAt), updatedAt: compactDateTime(announcement.updatedAt) })),
    documentPages: documentPages.map((document) => ({ id: document.id, slug: document.slug, title: document.title, body: document.body, category: document.category, status: document.status, visibilityRoles: normalizeRoles(document.visibilityRoles), sortOrder: document.sortOrder, createdBy: document.createdBy?.name ?? "系统", createdAt: compactDateTime(document.createdAt), updatedAt: compactDateTime(document.updatedAt) })),
    recentAdminActions: recentAdminActions.map((log) => ({ id: log.id, actor: log.actor?.name ?? "系统", email: log.actor?.email ?? "-", action: log.action, objectType: log.objectType, objectId: log.objectId, createdAt: compactDateTime(log.createdAt) })),
  };
}

export type AdminOverview = Prisma.PromiseReturnType<typeof getAdminOverview>;
function summarizeNamedCounts(items: Array<{ name: string; count: number }>) {
  const totals = new Map<string, number>();
  for (const item of items) totals.set(item.name, (totals.get(item.name) ?? 0) + item.count);
  return [...totals.entries()].map(([name, count]) => ({ name, count })).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "zh-CN"));
}
