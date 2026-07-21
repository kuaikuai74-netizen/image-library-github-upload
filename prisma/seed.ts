import { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { hashPassword } from "../lib/auth/password";
import { getStorageService } from "../lib/storage";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.DEV_ADMIN_EMAIL;
  const username = process.env.DEV_ADMIN_USERNAME;
  const password = process.env.DEV_ADMIN_PASSWORD;

  if (!email || !username || !password) {
    throw new Error("DEV_ADMIN_EMAIL、DEV_ADMIN_USERNAME 和 DEV_ADMIN_PASSWORD 必须在本地环境中设置。");
  }

  const passwordHash = await hashPassword(password);
  const storage = getStorageService();
  const administrator = await prisma.user.upsert({
    where: { email: email.toLocaleLowerCase("en-US") },
    update: {
      username,
      name: "开发环境超级管理员",
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
    create: {
      id: "dev-super-admin",
      email: email.toLocaleLowerCase("en-US"),
      username,
      name: "开发环境超级管理员",
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const catalog = [
    { code: "tables", name: "桌类", sortOrder: 1, previewSlot: 0, productName: "升降桌", spu: "Vertex Lift 01", amazonCountry: "DE", multiCountry: "FR", colors: ["白色", "黑色", "胡桃木色"] },
    { code: "casegoods", name: "板式", sortOrder: 2, previewSlot: 1, productName: "收纳柜", spu: "Cabinet Loft", amazonCountry: "UK", multiCountry: "NL", colors: ["橡木色", "白色"] },
    { code: "outdoor", name: "户外", sortOrder: 3, previewSlot: 2, productName: "庭院套装", spu: "Garden Set Pro", amazonCountry: "ES", multiCountry: "IT", colors: ["柚木色", "黑色"] },
    { code: "ecommerce-chairs", name: "电竞椅", sortOrder: 4, previewSlot: 3, productName: "电竞椅", spu: "Gaming Chair Pro", amazonCountry: "PL", multiCountry: "DE", colors: ["黑色", "银灰色"] },
    { code: "sofas", name: "沙发", sortOrder: 5, previewSlot: 4, productName: "模块沙发", spu: "Cloud Rest", amazonCountry: "FR", multiCountry: "UK", colors: ["灰色", "燕麦色"] },
    { code: "dining-bedroom", name: "蹦床", sortOrder: 6, previewSlot: 5, productName: "户外蹦床", spu: "Bounce Arena", amazonCountry: "NL", multiCountry: "PL", colors: ["蓝色", "黑色"] },
    { code: "pets", name: "宠物", sortOrder: 7, previewSlot: 6, productName: "宠物窝", spu: "Cozy Paw", amazonCountry: "IT", multiCountry: "ES", colors: ["浅灰色", "咖色"] },
  ] as const;
  const channelDefinitions = [
    { id: "channel-amazon", code: "amazon", name: "Amazon" },
    { id: "channel-multi", code: "multi", name: "多渠道" },
  ] as const;

  for (const channel of channelDefinitions) {
    await prisma.channel.upsert({ where: { code: channel.code }, update: { name: channel.name }, create: channel });
  }

  for (const item of catalog) {
    const category = await prisma.category.upsert({
      where: { code: item.code },
      update: { name: item.name, previewSlot: item.previewSlot, sortOrder: item.sortOrder },
      create: { id: `category-${item.code}`, code: item.code, name: item.name, previewSlot: item.previewSlot, sortOrder: item.sortOrder },
    });
    const product = await prisma.product.upsert({
      where: { id: `product-${item.code}` },
      update: { spu: item.spu, name: item.productName, categoryId: category.id },
      create: { id: `product-${item.code}`, spu: item.spu, name: item.productName, categoryId: category.id },
    });

    for (const channel of channelDefinitions) {
      const countryCode = channel.code === "amazon" ? item.amazonCountry : item.multiCountry;
      const assetType = channel.code === "amazon" ? "主副图" : "A+详情页";
      const group = await prisma.assetGroup.upsert({
        where: { id: `group-${channel.code}-${item.code}` },
        update: { channelId: channel.id, categoryId: category.id, productId: product.id, countryCode, assetType },
        create: {
          id: `group-${channel.code}-${item.code}`,
          channelId: channel.id,
          categoryId: category.id,
          productId: product.id,
          countryCode,
          assetType,
        },
      });

      const previousAssets = await prisma.asset.findMany({ where: { assetGroupId: group.id }, select: { fileObjectId: true } });
      await prisma.asset.deleteMany({ where: { assetGroupId: group.id } });
      await prisma.fileObject.deleteMany({ where: { id: { in: previousAssets.map((asset) => asset.fileObjectId) }, assets: { none: {} } } });

      for (let index = 0; index < 6; index += 1) {
        const sequence = index + 1;
        const width = [1600, 1500, 1600, 2000][index % 4];
        const height = [1600, 2000, 2133, 2000][index % 4];
        const originalStorageKey = `seed/${channel.code}/${item.code}/${sequence}.jpg`;
        const thumbnailStorageKey = `seed/thumbnails/${channel.code}/${item.code}/${sequence}.webp`;
        const previewStorageKey = `seed/previews/${channel.code}/${item.code}/${sequence}.webp`;
        const original = await sharp({ create: { width, height, channels: 3, background: index % 2 ? "#527a6c" : "#d1b18f" } }).jpeg({ quality: 86 }).toBuffer();
        const [thumbnail, preview] = await Promise.all([
          sharp(original).resize(480, 480, { fit: "inside" }).webp({ quality: 82 }).toBuffer(),
          sharp(original).resize(1600, 1600, { fit: "inside" }).webp({ quality: 88 }).toBuffer(),
        ]);
        await Promise.all([originalStorageKey, thumbnailStorageKey, previewStorageKey].map((key) => storage.delete(key)));
        await Promise.all([
          storage.put({ key: originalStorageKey, body: original }),
          storage.put({ key: thumbnailStorageKey, body: thumbnail }),
          storage.put({ key: previewStorageKey, body: preview }),
        ]);
        const fileObject = await prisma.fileObject.create({
          data: {
            id: `file-${channel.code}-${item.code}-${sequence}`,
            originalStorageKey,
            thumbnailStorageKey,
            previewStorageKey,
            sha256: createHash("sha256").update(`${channel.code}-${item.code}-${sequence}`).digest("hex"),
            mimeType: "image/jpeg",
            width,
            height,
            fileSizeBytes: original.byteLength,
            status: "ACTIVE",
          },
        });
        await prisma.asset.create({
          data: {
            id: `asset-${channel.code}-${item.code}-${sequence}`,
            assetGroupId: group.id,
            fileObjectId: fileObject.id,
            uploadedById: administrator.id,
            filename: `${item.spu}_${countryCode}_${assetType}_${String(sequence).padStart(2, "0")}.jpg`,
            originalFilename: `${item.spu}_${countryCode}_${assetType}_${String(sequence).padStart(2, "0")}.jpg`,
            sku: `${item.code.toUpperCase()}-${String(sequence).padStart(2, "0")}`,
            color: item.colors[index % item.colors.length],
            assetType,
            status: "ACTIVE",
            previewSlot: (item.previewSlot + index) % 8,
            sortOrder: sequence,
          },
        });
      }
    }
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
