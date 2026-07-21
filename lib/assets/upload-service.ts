import { createHash, randomUUID } from "node:crypto";
import { Prisma, type AssetStatus } from "@prisma/client";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { isReusableFileObject } from "@/lib/assets/file-object";
import { ImageValidationError, verifyImageBuffer } from "@/lib/assets/image-validation";
import { getStorageService } from "@/lib/storage";
import { createAssetStorageKeys } from "@/lib/storage/storage-keys";
import type { UploadMetadata } from "@/lib/assets/upload-schema";

export class UploadError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
  }
}

export type UploadFileInput = {
  file: File;
  metadata: UploadMetadata;
};

export type UploadFileResult = {
  assetId: string | null;
  originalFilename: string;
  status: AssetStatus;
  duplicateOfAssetId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

const maximumUploadBytes = Number(process.env.MAX_UPLOAD_BYTES ?? 26_214_400);

function failureDetails(error: unknown) {
  if (error instanceof UploadError) return { code: error.code, message: error.message };
  if (error instanceof ImageValidationError) return { code: "INVALID_IMAGE", message: error.message };
  return { code: "PROCESSING_FAILED", message: "图片处理失败。" };
}

async function removeKeys(keys: string[]) {
  const storage = getStorageService();
  await Promise.allSettled(keys.map((key) => storage.delete(key)));
}

async function processFile(uploadRequestId: string, assetGroupId: string, uploaderId: string, input: UploadFileInput): Promise<UploadFileResult> {
  const originalFilename = input.file.name || "未命名图片";
  const fileId = randomUUID();
  const { temporaryOriginalKey, originalKey, temporaryThumbnailKey, temporaryPreviewKey, thumbnailKey, previewKey } = createAssetStorageKeys(uploadRequestId, fileId);
  let finalizedOriginalKey = originalKey;
  let assetId: string | null = null;
  let fileObjectId: string | null = null;

  try {
    if (!input.file.size) throw new UploadError("EMPTY_FILE", "不允许上传空文件。");
    if (input.file.size > maximumUploadBytes) throw new UploadError("FILE_TOO_LARGE", `单个文件不得超过 ${Math.floor(maximumUploadBytes / 1_000_000)} MB。`);

    const source = Buffer.from(await input.file.arrayBuffer());
    const sha256 = createHash("sha256").update(source).digest("hex");
    const storage = getStorageService();
    const existingFileObject = await prisma.fileObject.findFirst({
      where: { sha256, status: "ACTIVE", cleanupStatus: { not: "COMPLETED" } },
      include: { assets: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 } },
      orderBy: { createdAt: "asc" },
    });
    if (isReusableFileObject(existingFileObject)) {
      const asset = await prisma.$transaction(async (transaction) => {
        await transaction.fileObject.update({ where: { id: existingFileObject.id }, data: { cleanupStatus: "NONE", cleanupError: null, cleanupRequestedAt: null } });
        const created = await transaction.asset.create({
          data: {
            assetGroupId,
            fileObjectId: existingFileObject.id,
            uploadedById: uploaderId,
            uploadRequestId,
            filename: originalFilename,
            originalFilename,
            sku: "",
            color: "未指定",
            assetType: input.metadata.assetType,
            status: "ACTIVE",
            previewSlot: 0,
            sortOrder: input.metadata.sortOrder,
          },
        });
        await transaction.auditLog.create({ data: { actorId: uploaderId, action: "ASSET_CREATED", objectType: "Asset", objectId: created.id, assetId: created.id, details: { duplicateOfAssetId: existingFileObject.assets[0]?.id ?? null } } });
        return created;
      });
      return { assetId: asset.id, originalFilename, status: "ACTIVE", duplicateOfAssetId: existingFileObject.assets[0]?.id ?? null, errorCode: null, errorMessage: null };
    }

    const fileObject = await prisma.fileObject.create({
      data: {
        originalStorageKey: originalKey,
        thumbnailStorageKey: thumbnailKey,
        previewStorageKey: previewKey,
        sha256,
        mimeType: "application/octet-stream",
        width: 0,
        height: 0,
        fileSizeBytes: source.byteLength,
        status: "PROCESSING",
      },
    });
    fileObjectId = fileObject.id;
    const asset = await prisma.asset.create({
      data: {
        assetGroupId,
        fileObjectId: fileObject.id,
        uploadedById: uploaderId,
        uploadRequestId,
        filename: originalFilename,
        originalFilename,
        sku: "",
        color: "未指定",
        assetType: input.metadata.assetType,
        status: "UPLOADING",
        previewSlot: 0,
        sortOrder: input.metadata.sortOrder,
      },
    });
    assetId = asset.id;
    await storage.put({ key: temporaryOriginalKey, body: source });
    await prisma.asset.update({ where: { id: asset.id }, data: { status: "PROCESSING" } });

    const format = await verifyImageBuffer(source);

    const [thumbnail, preview] = await Promise.all([
      sharp(source).rotate().resize(480, 480, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
      sharp(source).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toBuffer(),
    ]);
    await storage.put({ key: temporaryThumbnailKey, body: thumbnail });
    await storage.put({ key: temporaryPreviewKey, body: preview });
    finalizedOriginalKey = `${originalKey}.${format.extension}`;
    await storage.move(temporaryOriginalKey, finalizedOriginalKey);
    await storage.move(temporaryThumbnailKey, thumbnailKey);
    await storage.move(temporaryPreviewKey, previewKey);

    await prisma.$transaction([
      prisma.fileObject.update({
        where: { id: fileObject.id },
        data: {
          originalStorageKey: finalizedOriginalKey,
          mimeType: format.mimeType,
          width: format.width,
          height: format.height,
          status: "ACTIVE",
        },
      }),
      prisma.asset.update({ where: { id: asset.id }, data: { status: "ACTIVE", errorCode: null, errorMessage: null } }),
      prisma.auditLog.create({ data: { actorId: uploaderId, action: "ASSET_CREATED", objectType: "Asset", objectId: asset.id, assetId: asset.id } }),
    ]);
    return { assetId: asset.id, originalFilename, status: "ACTIVE", duplicateOfAssetId: null, errorCode: null, errorMessage: null };
  } catch (error) {
    const details = failureDetails(error);
    await removeKeys([temporaryOriginalKey, temporaryThumbnailKey, temporaryPreviewKey, finalizedOriginalKey, thumbnailKey, previewKey]);
    if (assetId) {
      await prisma.asset.update({ where: { id: assetId }, data: { status: "FAILED", errorCode: details.code, errorMessage: details.message } });
    }
    if (fileObjectId) {
      await prisma.fileObject.update({ where: { id: fileObjectId }, data: { status: "FAILED" } });
    }
    return { assetId, originalFilename, status: "FAILED", duplicateOfAssetId: null, errorCode: details.code, errorMessage: details.message };
  }
}

export async function uploadFiles(assetGroupId: string, uploaderId: string, idempotencyKey: string, inputs: UploadFileInput[]) {
  const existing = await findExistingUpload(idempotencyKey);
  if (existing) return existing;
  const assetGroup = await prisma.assetGroup.findUnique({ where: { id: assetGroupId }, select: { id: true } });
  if (!assetGroup) throw new UploadError("ASSET_GROUP_NOT_FOUND", "素材组不存在。", 404);

  let request;
  try {
    request = await prisma.uploadRequest.create({ data: { assetGroupId, uploaderId, idempotencyKey, status: "PROCESSING" } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const duplicate = await findExistingUpload(idempotencyKey);
      if (duplicate) return duplicate;
    }
    throw error;
  }
  const files = await Promise.all(inputs.map((input) => processFile(request.id, assetGroupId, uploaderId, input)));
  const activeCount = files.filter((file) => file.status === "ACTIVE").length;
  const status = activeCount === files.length ? "COMPLETED" : activeCount ? "PARTIAL" : "FAILED";
  await prisma.uploadRequest.update({ where: { id: request.id }, data: { status, completedAt: new Date() } });
  return { requestId: request.id, status, reused: false, files };
}

async function findExistingUpload(idempotencyKey: string) {
  const existing = await prisma.uploadRequest.findUnique({ include: { assets: { orderBy: { createdAt: "asc" } } }, where: { idempotencyKey } });
  if (!existing) return null;
  return {
    requestId: existing.id,
    status: existing.status,
    reused: true,
    files: existing.assets.map((asset) => ({ assetId: asset.id, originalFilename: asset.originalFilename, status: asset.status, duplicateOfAssetId: null, errorCode: asset.errorCode, errorMessage: asset.errorMessage })),
  };
}
