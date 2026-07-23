import { existsSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { getStorageService } from "../lib/storage";

function loadLocalEnv() {
  const envPath = path.resolve(".env");
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function storageRoot() {
  return path.resolve(process.env.LOCAL_STORAGE_ROOT ?? "./data/storage");
}

async function removeStorageDirectories() {
  const root = storageRoot();
  const directories = ["seed", "temporary", "originals", "thumbnails", "previews"];
  await Promise.all(directories.map((directory) => rm(path.join(root, directory), { recursive: true, force: true })));
}

async function main() {
  loadLocalEnv();
  const prisma = new PrismaClient();
  try {
    const storage = getStorageService();
    const fileObjects = await prisma.fileObject.findMany({
      select: { originalStorageKey: true, thumbnailStorageKey: true, previewStorageKey: true },
    });
    const storageKeys = new Set(fileObjects.flatMap((fileObject) => [
      fileObject.originalStorageKey,
      fileObject.thumbnailStorageKey,
      fileObject.previewStorageKey,
    ].filter((key): key is string => Boolean(key))));

    const [counts] = await prisma.$transaction([
      prisma.$queryRaw<Array<{
        assets: bigint;
        file_objects: bigint;
        asset_groups: bigint;
        products: bigint;
        upload_requests: bigint;
        audit_logs: bigint;
      }>>`
        SELECT
          (SELECT COUNT(*) FROM "Asset") AS assets,
          (SELECT COUNT(*) FROM "FileObject") AS file_objects,
          (SELECT COUNT(*) FROM "AssetGroup") AS asset_groups,
          (SELECT COUNT(*) FROM "Product") AS products,
          (SELECT COUNT(*) FROM "UploadRequest") AS upload_requests,
          (SELECT COUNT(*) FROM "AuditLog") AS audit_logs
      `,
      prisma.auditLog.deleteMany(),
      prisma.asset.deleteMany(),
      prisma.uploadRequest.deleteMany(),
      prisma.assetGroup.deleteMany(),
      prisma.product.deleteMany(),
      prisma.fileObject.deleteMany(),
    ]);

    await Promise.allSettled([...storageKeys].map((key) => storage.delete(key)));
    await removeStorageDirectories();

    const before = counts[0];
    console.log(`Cleared ${before.assets} assets, ${before.file_objects} file objects, ${before.asset_groups} asset groups, ${before.products} products, ${before.upload_requests} upload requests, and ${before.audit_logs} audit logs.`);
    console.log(`Removed ${storageKeys.size} referenced storage objects and local storage asset directories under ${storageRoot()}.`);
    console.log("Preserved users, channels, categories, environment files, dependencies, and build output.");
  } finally {
    await prisma.$disconnect();
  }
}

main();
