import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getStorageService } from "@/lib/storage";

const cleanupTakeLimit = 50;

function compactDateTime(value: Date | null) {
  return value ? value.toLocaleString("zh-CN", { hour12: false }) : "-";
}

function formatStorageError(error: unknown) {
  return error instanceof Error ? error.message : "未知错误";
}

function storageKeys(fileObject: { originalStorageKey: string; thumbnailStorageKey: string | null; previewStorageKey: string | null }) {
  return [fileObject.originalStorageKey, fileObject.thumbnailStorageKey, fileObject.previewStorageKey].filter((key): key is string => Boolean(key));
}

async function runStorageProbe() {
  const storage = getStorageService();
  const key = `health/${randomUUID()}.txt`;
  try {
    await storage.put({ key, body: new TextEncoder().encode("ok") });
    const existsAfterWrite = await storage.exists(key);
    const readObject = await storage.get(key);
    const deleted = await storage.delete(key);
    return {
      status: existsAfterWrite && readObject && deleted ? "HEALTHY" : "DEGRADED",
      writable: existsAfterWrite,
      readable: Boolean(readObject),
      deletable: deleted,
      checkedAt: compactDateTime(new Date()),
      message: existsAfterWrite && readObject && deleted ? "存储读写删除探针通过。" : "存储探针未完全通过，请检查存储权限。",
    };
  } catch (error) {
    await storage.delete(key).catch(() => false);
    return {
      status: "FAILED",
      writable: false,
      readable: false,
      deletable: false,
      checkedAt: compactDateTime(new Date()),
      message: formatStorageError(error),
    };
  }
}

export async function getAdminStorageHealth() {
  const [probe, statusCounts, cleanupCounts, storageUsage, pendingFileObjects, missingOriginals, missingThumbnails, missingPreviews, activeReferencesOnPending, activeScanFileObjects] = await Promise.all([
    runStorageProbe(),
    prisma.fileObject.groupBy({ by: ["status"], _count: { _all: true }, orderBy: { status: "asc" } }),
    prisma.fileObject.groupBy({ by: ["cleanupStatus"], _count: { _all: true }, orderBy: { cleanupStatus: "asc" } }),
    prisma.fileObject.aggregate({ where: { status: "ACTIVE" }, _sum: { fileSizeBytes: true } }),
    prisma.fileObject.findMany({
      where: { cleanupStatus: { in: ["PENDING", "FAILED"] } },
      include: {
        _count: { select: { assets: { where: { status: "ACTIVE" } } } },
        assets: { select: { filename: true, assetGroup: { select: { product: { select: { spu: true } } } } }, orderBy: { updatedAt: "desc" }, take: 1 },
      },
      orderBy: [{ cleanupStatus: "asc" }, { cleanupRequestedAt: "desc" }, { updatedAt: "desc" }],
      take: cleanupTakeLimit,
    }),
    prisma.fileObject.count({ where: { status: "ACTIVE", originalStorageKey: "" } }),
    prisma.fileObject.count({ where: { status: "ACTIVE", thumbnailStorageKey: null } }),
    prisma.fileObject.count({ where: { status: "ACTIVE", previewStorageKey: null } }),
    prisma.fileObject.count({ where: { cleanupStatus: "PENDING", assets: { some: { status: "ACTIVE" } } } }),
    prisma.fileObject.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, originalStorageKey: true, thumbnailStorageKey: true, previewStorageKey: true },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
  ]);
  const storage = getStorageService();
  const scannedKeys = activeScanFileObjects.flatMap((fileObject) => storageKeys(fileObject).map((key) => ({ fileObjectId: fileObject.id, key })));
  const missingKeys = [];
  for (const item of scannedKeys) {
    if (!(await storage.exists(item.key))) missingKeys.push(item);
  }

  return {
    driver: process.env.STORAGE_DRIVER ?? "local",
    root: process.env.LOCAL_STORAGE_ROOT ?? "./data/storage",
    probe,
    storageBytes: storageUsage._sum.fileSizeBytes ?? 0,
    fileStatusCounts: statusCounts.map((item) => ({ status: item.status, count: item._count._all })),
    cleanupStatusCounts: cleanupCounts.map((item) => ({ status: item.cleanupStatus, count: item._count._all })),
    missingDerivatives: {
      originalRecords: missingOriginals,
      thumbnails: missingThumbnails,
      previews: missingPreviews,
    },
    fileExistenceScan: {
      fileObjects: activeScanFileObjects.length,
      keys: scannedKeys.length,
      missingKeys: missingKeys.slice(0, 20),
      missingCount: missingKeys.length,
    },
    pendingActiveReferenceCount: activeReferencesOnPending,
    cleanupCandidates: pendingFileObjects.map((fileObject) => ({
      id: fileObject.id,
      status: fileObject.status,
      cleanupStatus: fileObject.cleanupStatus,
      cleanupError: fileObject.cleanupError ?? "-",
      cleanupRequestedAt: compactDateTime(fileObject.cleanupRequestedAt),
      updatedAt: compactDateTime(fileObject.updatedAt),
      fileSizeBytes: fileObject.fileSizeBytes,
      activeReferences: fileObject._count.assets,
      sampleAsset: fileObject.assets[0] ? `${fileObject.assets[0].assetGroup.product.spu} · ${fileObject.assets[0].filename}` : "-",
      keys: storageKeys(fileObject),
    })),
  };
}

export async function cleanupPendingFileObjects(limit = 20) {
  const storage = getStorageService();
  const candidates = await prisma.fileObject.findMany({
    where: { cleanupStatus: "PENDING", assets: { none: { status: "ACTIVE" } } },
    orderBy: [{ cleanupRequestedAt: "asc" }, { updatedAt: "asc" }],
    take: Math.min(Math.max(limit, 1), 50),
  });

  const results = [];
  for (const fileObject of candidates) {
    const keys = storageKeys(fileObject);
    try {
      const deleted = [];
      for (const key of keys) {
        deleted.push({ key, deleted: await storage.delete(key) });
      }
      await prisma.fileObject.update({
        where: { id: fileObject.id },
        data: { status: "FAILED", cleanupStatus: "COMPLETED", cleanupError: null },
      });
      results.push({ id: fileObject.id, status: "COMPLETED", deleted });
    } catch (error) {
      const message = formatStorageError(error);
      await prisma.fileObject.update({
        where: { id: fileObject.id },
        data: { cleanupStatus: "FAILED", cleanupError: message },
      });
      results.push({ id: fileObject.id, status: "FAILED", error: message });
    }
  }

  return {
    requested: limit,
    processed: results.length,
    completed: results.filter((item) => item.status === "COMPLETED").length,
    failed: results.filter((item) => item.status === "FAILED").length,
    results,
  };
}

export type AdminStorageHealth = Awaited<ReturnType<typeof getAdminStorageHealth>>;
