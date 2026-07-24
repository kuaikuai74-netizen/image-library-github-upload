import { prisma } from "@/lib/prisma";
import { getStorageService } from "@/lib/storage";

type MissingKey = { fileObjectId: string; key: string; variant: "original" | "thumbnail" | "preview" };

const batchSize = positiveInteger("VERIFY_STORAGE_BATCH_SIZE", 100);
const detailLimit = positiveInteger("VERIFY_STORAGE_DETAIL_LIMIT", 20);

function positiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function requiredKeys(fileObject: { id: string; originalStorageKey: string; thumbnailStorageKey: string | null; previewStorageKey: string | null }) {
  const keys: MissingKey[] = [];
  if (fileObject.originalStorageKey) keys.push({ fileObjectId: fileObject.id, key: fileObject.originalStorageKey, variant: "original" });
  if (fileObject.thumbnailStorageKey) keys.push({ fileObjectId: fileObject.id, key: fileObject.thumbnailStorageKey, variant: "thumbnail" });
  if (fileObject.previewStorageKey) keys.push({ fileObjectId: fileObject.id, key: fileObject.previewStorageKey, variant: "preview" });
  return keys;
}

async function findMissingStorageKeys() {
  const storage = getStorageService();
  const missing: MissingKey[] = [];
  let checkedFileObjects = 0;
  let checkedKeys = 0;
  let cursor: string | undefined;

  while (true) {
    const fileObjects = await prisma.fileObject.findMany({
      where: { status: "ACTIVE" },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, originalStorageKey: true, thumbnailStorageKey: true, previewStorageKey: true },
    });
    if (!fileObjects.length) break;
    cursor = fileObjects[fileObjects.length - 1].id;
    checkedFileObjects += fileObjects.length;

    for (const fileObject of fileObjects) {
      for (const item of requiredKeys(fileObject)) {
        checkedKeys += 1;
        if (!(await storage.exists(item.key))) missing.push(item);
      }
    }
  }

  return { checkedFileObjects, checkedKeys, missing };
}

async function main() {
  const [activeAssetsWithInactiveFileObject, activeFileObjectsMissingOriginal, activeFileObjectsMissingThumbnail, activeFileObjectsMissingPreview, pendingCleanupWithActiveReferences, storageScan] = await Promise.all([
    prisma.asset.count({ where: { status: "ACTIVE", fileObject: { status: { not: "ACTIVE" } } } }),
    prisma.fileObject.count({ where: { status: "ACTIVE", originalStorageKey: "" } }),
    prisma.fileObject.count({ where: { status: "ACTIVE", thumbnailStorageKey: null } }),
    prisma.fileObject.count({ where: { status: "ACTIVE", previewStorageKey: null } }),
    prisma.fileObject.count({ where: { cleanupStatus: "PENDING", assets: { some: { status: "ACTIVE" } } } }),
    findMissingStorageKeys(),
  ]);

  const issueCount = activeAssetsWithInactiveFileObject
    + activeFileObjectsMissingOriginal
    + activeFileObjectsMissingThumbnail
    + activeFileObjectsMissingPreview
    + pendingCleanupWithActiveReferences
    + storageScan.missing.length;

  console.log("Storage consistency verification");
  console.log(`Checked active file objects: ${storageScan.checkedFileObjects}`);
  console.log(`Checked storage keys: ${storageScan.checkedKeys}`);
  console.log(`Active assets with inactive file objects: ${activeAssetsWithInactiveFileObject}`);
  console.log(`Active file objects missing original keys: ${activeFileObjectsMissingOriginal}`);
  console.log(`Active file objects missing thumbnail keys: ${activeFileObjectsMissingThumbnail}`);
  console.log(`Active file objects missing preview keys: ${activeFileObjectsMissingPreview}`);
  console.log(`Pending cleanup file objects with active references: ${pendingCleanupWithActiveReferences}`);
  console.log(`Missing physical storage keys: ${storageScan.missing.length}`);

  if (storageScan.missing.length) {
    console.log("Missing key samples:");
    storageScan.missing.slice(0, detailLimit).forEach((item) => console.log(`- ${item.variant}: ${item.fileObjectId} -> ${item.key}`));
  }

  if (issueCount > 0) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
