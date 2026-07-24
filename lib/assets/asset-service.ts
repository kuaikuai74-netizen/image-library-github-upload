import type { Prisma, UserRole } from "@prisma/client";
import { hasAssetPermission } from "@/lib/auth/permissions";
import { countryName } from "@/lib/library/countries";
import { prisma } from "@/lib/prisma";
import { UploadError } from "@/lib/assets/upload-service";
import type { DownloadableAsset } from "@/lib/assets/download-service";
import type { AssetMutation } from "@/lib/assets/asset-schema";

const assetDetailsInclude = {
  assetGroup: { include: { channel: true, category: true, product: true } },
  fileObject: true,
  uploadedBy: { select: { id: true, name: true } },
  deletedBy: { select: { id: true, name: true } },
} satisfies Prisma.AssetInclude;

export type ManagedAsset = Prisma.AssetGetPayload<{ include: typeof assetDetailsInclude }>;

export async function getManagedAsset(assetId: string) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId }, include: assetDetailsInclude });
  if (!asset) throw new UploadError("ASSET_NOT_FOUND", "素材不存在。", 404);
  return asset;
}

export async function updateAsset(assetId: string, actorId: string, input: AssetMutation) {
  const current = await getManagedAsset(assetId);
  if (current.status !== "ACTIVE") throw new UploadError("ASSET_NOT_ACTIVE", "只有活动素材可以修改。", 409);
  if (input.assetGroupId && input.assetGroupId !== current.assetGroupId) {
    const destination = await prisma.assetGroup.findUnique({ where: { id: input.assetGroupId }, select: { id: true } });
    if (!destination) throw new UploadError("ASSET_GROUP_NOT_FOUND", "目标素材组不存在。", 404);
  }

  const moved = input.assetGroupId !== undefined && input.assetGroupId !== current.assetGroupId;
  const asset = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.asset.update({ where: { id: assetId }, data: input });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: moved ? "ASSET_MOVED" : "ASSET_UPDATED",
        objectType: "Asset",
        objectId: assetId,
        assetId,
        details: { previousAssetGroupId: moved ? current.assetGroupId : undefined, changes: input },
      },
    });
    return updated;
  });
  return asset;
}

export async function softDeleteAsset(assetId: string, actorId: string) {
  const current = await getManagedAsset(assetId);
  if (current.status !== "ACTIVE") throw new UploadError("ASSET_NOT_ACTIVE", "素材已经不在活动库中。", 409);
  return prisma.$transaction(async (transaction) => {
    const deletedAt = new Date();
    const asset = await transaction.asset.update({ where: { id: assetId }, data: { status: "DELETED", deletedAt, deletedById: actorId } });
    const activeReferences = await transaction.asset.count({ where: { fileObjectId: current.fileObjectId, status: "ACTIVE" } });
    if (activeReferences === 0) {
      await transaction.fileObject.update({ where: { id: current.fileObjectId }, data: { cleanupStatus: "PENDING", cleanupRequestedAt: deletedAt, cleanupError: null } });
    }
    await transaction.auditLog.create({ data: { actorId, action: "ASSET_DELETED", objectType: "Asset", objectId: assetId, assetId } });
    return asset;
  });
}

export async function restoreAsset(assetId: string, actorId: string) {
  const current = await getManagedAsset(assetId);
  if (current.status !== "DELETED") throw new UploadError("ASSET_NOT_DELETED", "只有回收站中的素材可以恢复。", 409);
  if (current.fileObject.status !== "ACTIVE" || current.fileObject.cleanupStatus === "COMPLETED") {
    throw new UploadError("FILE_OBJECT_UNAVAILABLE", "关联文件已不可恢复。", 409);
  }
  return prisma.$transaction(async (transaction) => {
    await transaction.fileObject.update({ where: { id: current.fileObjectId }, data: { cleanupStatus: "NONE", cleanupRequestedAt: null, cleanupError: null } });
    const asset = await transaction.asset.update({ where: { id: assetId }, data: { status: "ACTIVE", deletedAt: null, deletedById: null } });
    await transaction.auditLog.create({ data: { actorId, action: "ASSET_RESTORED", objectType: "Asset", objectId: assetId, assetId } });
    return asset;
  });
}

export async function listRecycleBin(role: UserRole, userId: string, page: number, pageSize: number) {
  if (!hasAssetPermission(role, "delete", { userId })) throw new UploadError("FORBIDDEN", "无权查看回收站。", 403);
  const where: Prisma.AssetWhereInput = { status: "DELETED" };
  const [items, total] = await prisma.$transaction([
    prisma.asset.findMany({ where, include: assetDetailsInclude, orderBy: { deletedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.asset.count({ where }),
  ]);
  return {
    items: items.map((asset) => ({
      id: asset.id,
      filename: asset.filename,
      assetType: asset.assetType,
      color: asset.color,
      deletedAt: asset.deletedAt,
      fileObject: { cleanupStatus: asset.fileObject.cleanupStatus },
      assetGroup: { product: { spu: asset.assetGroup.product.spu } },
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function listAssetLogs(assetId: string) {
  await getManagedAsset(assetId);
  return prisma.auditLog.findMany({ where: { assetId }, include: { actor: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
}

export async function getDownloadableAsset(assetId: string) {
  const asset = await prisma.asset.findFirst({ where: { id: assetId, status: "ACTIVE" }, include: { fileObject: true } });
  if (!asset || asset.fileObject.status !== "ACTIVE") throw new UploadError("ASSET_NOT_FOUND", "素材不存在或不可下载。", 404);
  return asset;
}

export async function logDownload(assetId: string, actorId: string, action: "ASSET_DOWNLOADED" | "BATCH_DOWNLOAD_REQUESTED" = "ASSET_DOWNLOADED") {
  await prisma.auditLog.create({ data: { actorId, action, objectType: "Asset", objectId: assetId, assetId } });
}

export async function prepareBatchDownload(assetIds: string[]) {
  const assets = await prisma.asset.findMany({ where: { id: { in: assetIds }, status: "ACTIVE" }, include: { fileObject: true } });
  const byId = new Map(assets.filter((asset) => asset.fileObject.status === "ACTIVE").map((asset) => [asset.id, asset]));
  const items = assetIds.map((assetId) => {
    const asset = byId.get(assetId);
    return asset ? { assetId, status: "READY" as const, filename: asset.filename, errorCode: null } : { assetId, status: "FAILED" as const, filename: null, errorCode: "ASSET_NOT_FOUND" };
  });
  return { items, readyIds: items.filter((item) => item.status === "READY").map((item) => item.assetId) };
}

export async function listDownloadableProductAssets(productIds: string[], scope: { channelId?: string; categoryId?: string }): Promise<DownloadableAsset[]> {
  const assets = await prisma.asset.findMany({
    where: {
      status: "ACTIVE",
      assetGroup: {
        productId: { in: productIds },
        channelId: scope.channelId,
        categoryId: scope.categoryId,
      },
    },
    include: { fileObject: true, assetGroup: { include: { product: { select: { spu: true } } } } },
  });
  return assets
    .filter((asset) => asset.fileObject.status === "ACTIVE")
    .sort((left, right) =>
      left.assetGroup.product.spu.localeCompare(right.assetGroup.product.spu, "zh-CN")
      || left.assetGroup.countryCode.localeCompare(right.assetGroup.countryCode, "zh-CN")
      || left.assetType.localeCompare(right.assetType, "zh-CN")
      || left.sortOrder - right.sortOrder
      || left.createdAt.getTime() - right.createdAt.getTime()
    )
    .map((asset) => ({
      id: asset.id,
      filename: asset.filename,
      archivePath: [countryName(asset.assetGroup.countryCode), asset.assetType, asset.color || "未指定"],
      fileObject: { originalStorageKey: asset.fileObject.originalStorageKey },
    }));
}

export async function logBatchDownloadAssets(assetIds: string[], actorId: string) {
  if (!assetIds.length) return;
  await prisma.auditLog.createMany({
    data: assetIds.map((assetId) => ({ actorId, action: "BATCH_DOWNLOAD_REQUESTED", objectType: "Asset", objectId: assetId, assetId })),
  });
}
