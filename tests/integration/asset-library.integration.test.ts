import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const testStorageRoot = process.env.TEST_STORAGE_ROOT;
const adminEmail = process.env.TEST_ADMIN_EMAIL;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;

if (!testDatabaseUrl || !testStorageRoot || !adminEmail || !adminPassword) {
  throw new Error("Integration tests require TEST_DATABASE_URL, TEST_STORAGE_ROOT, TEST_ADMIN_EMAIL, and TEST_ADMIN_PASSWORD.");
}

process.env.DATABASE_URL = testDatabaseUrl;
process.env.LOCAL_STORAGE_ROOT = testStorageRoot;
process.env.STORAGE_DRIVER = "local";

const [{ prisma }, { authenticateCredentials }, { hasAssetPermission }, { hashPassword }, { listAssets }, { uploadFiles }, { softDeleteAsset, restoreAsset }, { getStorageService }] = await Promise.all([
  import("../../lib/prisma"),
  import("../../lib/auth/authenticate"),
  import("../../lib/auth/permissions"),
  import("../../lib/auth/password"),
  import("../../lib/library/repository"),
  import("../../lib/assets/upload-service"),
  import("../../lib/assets/asset-service"),
  import("../../lib/storage"),
]);

let uploadedAssetIds: string[] = [];
let fileObjectKeys: string[] = [];
let viewerId = "";

describe("asset library integration", () => {
  let administratorId = "";
  let assetGroupId = "";

  beforeAll(async () => {
    const administrator = await authenticateCredentials({ identifier: adminEmail, password: adminPassword });
    expect(administrator).not.toBeNull();
    administratorId = administrator?.id ?? "";
    const group = await prisma.assetGroup.findFirst({ orderBy: { createdAt: "asc" } });
    expect(group).not.toBeNull();
    assetGroupId = group?.id ?? "";
    const viewer = await prisma.user.upsert({
      where: { email: "integration-viewer@example.test" },
      update: { passwordHash: await hashPassword("integration-viewer-password"), role: "VIEWER", status: "ACTIVE", name: "Integration Viewer", username: "integration-viewer" },
      create: { email: "integration-viewer@example.test", username: "integration-viewer", name: "Integration Viewer", passwordHash: await hashPassword("integration-viewer-password"), role: "VIEWER", status: "ACTIVE" },
    });
    viewerId = viewer.id;
  });

  afterAll(async () => {
    const objects = await prisma.fileObject.findMany({ where: { assets: { some: { id: { in: uploadedAssetIds } } } } });
    await prisma.asset.deleteMany({ where: { id: { in: uploadedAssetIds } } });
    await prisma.fileObject.deleteMany({ where: { id: { in: objects.map((object) => object.id) }, assets: { none: {} } } });
    const storage = getStorageService();
    await Promise.all(fileObjectKeys.map((key) => storage.delete(key)));
    await prisma.user.deleteMany({ where: { id: viewerId } });
    await prisma.$disconnect();
  });

  it("authenticates the seeded administrator and rejects an invalid password", async () => {
    await expect(authenticateCredentials({ identifier: adminEmail, password: adminPassword })).resolves.toMatchObject({ email: adminEmail.toLocaleLowerCase("en-US") });
    await expect(authenticateCredentials({ identifier: adminEmail, password: "incorrect-password" })).resolves.toBeNull();
  });

  it("queries only active, paginated assets", async () => {
    const page = await listAssets({ page: 1, pageSize: 10, channelId: undefined, categoryId: undefined, countryCode: undefined, assetType: undefined, color: undefined, spu: undefined, filename: undefined, q: undefined });
    expect(page.items).toHaveLength(Math.min(page.total, 10));
    expect(page.items.every((asset) => asset.thumbnailUrl?.startsWith("/api/assets/") ?? true)).toBe(true);
  });

  it("authenticates a viewer while rejecting management permissions", async () => {
    const viewer = await authenticateCredentials({ identifier: "integration-viewer", password: "integration-viewer-password" });
    expect(viewer).toMatchObject({ id: viewerId, role: "VIEWER" });
    expect(hasAssetPermission(viewer?.role ?? "VIEWER", "edit", { userId: viewer?.id, uploadedById: administratorId })).toBe(false);
    expect(hasAssetPermission(viewer?.role ?? "VIEWER", "delete", { userId: viewer?.id, uploadedById: administratorId })).toBe(false);
  });

  it("uploads an image, persists its file object, and reuses the duplicate", async () => {
    const png = await sharp({ create: { width: 12, height: 8, channels: 3, background: "#7dd0b5" } }).png().toBuffer();
    const imageBytes = Uint8Array.from(png);
    const first = await uploadFiles(assetGroupId, administratorId, crypto.randomUUID(), [{ file: new File([imageBytes], "integration.png", { type: "image/png" }), metadata: { assetType: "A+详情页", sortOrder: 991 } }]);
    const second = await uploadFiles(assetGroupId, administratorId, crypto.randomUUID(), [{ file: new File([imageBytes], "integration-copy.png", { type: "application/octet-stream" }), metadata: { assetType: "A+详情页", sortOrder: 992 } }]);
    const firstAssetId = first.files[0]?.assetId;
    const secondAssetId = second.files[0]?.assetId;
    expect(first.files[0]).toMatchObject({ status: "ACTIVE", duplicateOfAssetId: null });
    expect(second.files[0]?.duplicateOfAssetId).toBe(firstAssetId);
    expect(firstAssetId).toBeTruthy();
    expect(secondAssetId).toBeTruthy();
    uploadedAssetIds = [firstAssetId ?? "", secondAssetId ?? ""].filter(Boolean);

    const persisted = await prisma.asset.findMany({ where: { id: { in: uploadedAssetIds } }, include: { fileObject: true } });
    expect(persisted).toHaveLength(2);
    expect(new Set(persisted.map((asset) => asset.fileObjectId)).size).toBe(1);
    expect(persisted[0]?.fileObject.mimeType).toBe("image/png");
    fileObjectKeys = [persisted[0]?.fileObject.originalStorageKey, persisted[0]?.fileObject.thumbnailStorageKey, persisted[0]?.fileObject.previewStorageKey].filter((key): key is string => Boolean(key));
  });

  it("soft-deletes and restores without removing a shared file object", async () => {
    const assetId = uploadedAssetIds[0];
    expect(assetId).toBeTruthy();
    await softDeleteAsset(assetId, administratorId);
    const deleted = await prisma.asset.findUnique({ where: { id: assetId }, include: { fileObject: true } });
    expect(deleted).toMatchObject({ status: "DELETED", fileObject: { status: "ACTIVE" } });
    await restoreAsset(assetId, administratorId);
    await expect(prisma.asset.findUnique({ where: { id: assetId } })).resolves.toMatchObject({ status: "ACTIVE", deletedAt: null });
  });
});
