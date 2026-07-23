import type { DownloadBatchType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UploadError } from "@/lib/assets/upload-service";
import { getStorageService } from "@/lib/storage";
import type { DownloadableAsset, FailedDownloadItem } from "@/lib/assets/download-service";

type DownloadBatchItemInput = {
  assetId: string | null;
  status: "READY" | "FAILED";
  filename: string | null;
  archivePath?: string[];
  errorCode: string | null;
  errorMessage?: string | null;
};

type BatchClientInfo = {
  ipAddress: string | null;
  userAgent: string | null;
};

const batchAssetInclude = {
  items: { include: { asset: { include: { fileObject: true } } }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.DownloadBatchInclude;

function archivePathValue(archivePath: string[] | undefined) {
  return archivePath?.length ? archivePath.join("/") : null;
}

function archivePathArray(archivePath: string | null) {
  return archivePath ? archivePath.split("/").filter(Boolean) : undefined;
}

export function batchClientInfo(request: Request): BatchClientInfo {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const realIp = request.headers.get("x-real-ip")?.trim() || null;
  return { ipAddress: forwardedFor ?? realIp, userAgent: request.headers.get("user-agent") };
}

export async function createDownloadBatch(input: { actorId: string; type: DownloadBatchType; zipFilename: string; items: DownloadBatchItemInput[]; scope?: Prisma.InputJsonValue }) {
  const readyCount = input.items.filter((item) => item.status === "READY").length;
  const failedCount = input.items.length - readyCount;
  const batch = await prisma.downloadBatch.create({
    data: {
      actorId: input.actorId,
      type: input.type,
      status: readyCount ? "PREPARED" : "FAILED",
      requestedCount: input.items.length,
      readyCount,
      failedCount,
      zipFilename: input.zipFilename,
      scope: input.scope,
      items: {
        create: input.items.map((item) => ({
          assetId: item.assetId,
          status: item.status,
          filename: item.filename,
          archivePath: archivePathValue(item.archivePath),
          errorCode: item.errorCode,
          errorMessage: item.errorMessage,
        })),
      },
    },
    include: { items: true },
  });
  return {
    id: batch.id,
    items: batch.items.map((item) => ({ assetId: item.assetId ?? "", status: item.status, filename: item.filename, errorCode: item.errorCode })),
    readyIds: batch.items.filter((item) => item.status === "READY" && item.assetId).map((item) => item.assetId as string),
    readyCount,
  };
}

export async function executeDownloadBatch(batchId: string, actorId: string, clientInfo: BatchClientInfo) {
  const batch = await prisma.downloadBatch.findUnique({ where: { id: batchId }, include: batchAssetInclude });
  if (!batch || batch.actorId !== actorId) throw new UploadError("DOWNLOAD_BATCH_NOT_FOUND", "下载批次不存在。", 404);

  const storage = getStorageService();
  const readyAssets: DownloadableAsset[] = [];
  const failedItems: FailedDownloadItem[] = [];
  const itemUpdates: Array<{ id: string; status: "DOWNLOADED" | "FAILED"; errorCode?: string; errorMessage?: string }> = [];

  for (const item of batch.items) {
    const asset = item.asset;
    if (item.status === "FAILED") {
      failedItems.push({ assetId: item.assetId, filename: item.filename, status: "FAILED", errorCode: item.errorCode });
      continue;
    }
    if (!asset || asset.status !== "ACTIVE" || asset.fileObject.status !== "ACTIVE") {
      failedItems.push({ assetId: item.assetId, filename: item.filename, status: "FAILED", errorCode: "ASSET_NOT_FOUND" });
      itemUpdates.push({ id: item.id, status: "FAILED", errorCode: "ASSET_NOT_FOUND", errorMessage: "素材不存在或不可下载。" });
      continue;
    }
    if (!(await storage.exists(asset.fileObject.originalStorageKey))) {
      failedItems.push({ assetId: item.assetId, filename: item.filename, status: "FAILED", errorCode: "FILE_NOT_FOUND" });
      itemUpdates.push({ id: item.id, status: "FAILED", errorCode: "FILE_NOT_FOUND", errorMessage: "原文件不存在。" });
      continue;
    }
    readyAssets.push({ id: asset.id, filename: item.filename ?? asset.filename, archivePath: archivePathArray(item.archivePath), fileObject: { originalStorageKey: asset.fileObject.originalStorageKey } });
    itemUpdates.push({ id: item.id, status: "DOWNLOADED" });
  }

  const downloadedCount = readyAssets.length;
  const failedCount = failedItems.length;
  const status = downloadedCount === 0 ? "FAILED" : failedCount > 0 ? "PARTIAL" : "DOWNLOADED";

  await prisma.$transaction(async (transaction) => {
    for (const item of itemUpdates) {
      await transaction.downloadBatchItem.update({ where: { id: item.id }, data: { status: item.status, errorCode: item.errorCode, errorMessage: item.errorMessage } });
    }
    await transaction.downloadBatch.update({
      where: { id: batch.id },
      data: { status, readyCount: downloadedCount, failedCount, downloadedAt: new Date(), ipAddress: clientInfo.ipAddress, userAgent: clientInfo.userAgent },
    });
    if (readyAssets.length) {
      await transaction.auditLog.createMany({ data: readyAssets.map((asset) => ({ actorId, action: "BATCH_DOWNLOAD_REQUESTED", objectType: "Asset", objectId: asset.id, assetId: asset.id, details: { batchId: batch.id, type: batch.type } })) });
    }
  });

  if (!readyAssets.length) throw new UploadError("NO_DOWNLOADABLE_ASSETS", "没有可下载的素材。", 404);
  return { batch: { id: batch.id, zipFilename: batch.zipFilename }, assets: readyAssets, failedItems };
}
