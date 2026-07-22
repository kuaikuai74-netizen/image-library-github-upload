import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UploadContext } from "@/lib/assets/upload-schema";
import { UploadError } from "@/lib/assets/upload-service";

export async function ensureAssetGroup(context: UploadContext) {
  const [channel, category] = await Promise.all([
    prisma.channel.findUnique({ where: { id: context.channelId }, select: { id: true } }),
    prisma.category.findUnique({ where: { id: context.categoryId }, select: { id: true } }),
  ]);
  if (!channel) throw new UploadError("CHANNEL_NOT_FOUND", "渠道不存在。", 404);
  if (!category) throw new UploadError("CATEGORY_NOT_FOUND", "品类不存在。", 404);

  const product = await findOrCreateProduct(context.spu, context.categoryId);
  if (product.categoryId !== context.categoryId) throw new UploadError("PRODUCT_CATEGORY_MISMATCH", "输入的 SPU 已属于其他品类。");

  const assetGroup = await prisma.assetGroup.upsert({
    where: {
      channelId_productId_countryCode_assetType: {
        channelId: context.channelId,
        productId: product.id,
        countryCode: context.countryCode,
        assetType: context.assetType,
      },
    },
    update: {},
    create: {
      channelId: context.channelId,
      categoryId: context.categoryId,
      productId: product.id,
      countryCode: context.countryCode,
      assetType: context.assetType,
    },
    select: { id: true, categoryId: true },
  });
  if (assetGroup.categoryId !== context.categoryId) throw new UploadError("ASSET_GROUP_CATEGORY_MISMATCH", "已有素材组不属于所选品类。");
  return assetGroup;
}

async function findOrCreateProduct(spu: string, categoryId: string) {
  const existing = await findProductBySpu(spu);
  if (existing) return existing;

  try {
    return await prisma.product.create({
      data: { spu, name: spu, categoryId },
      select: { id: true, categoryId: true },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const concurrentProduct = await findProductBySpu(spu);
    if (concurrentProduct) return concurrentProduct;
    throw error;
  }
}

function findProductBySpu(spu: string) {
  return prisma.product.findFirst({
    where: { spu: { equals: spu, mode: "insensitive" } },
    orderBy: { createdAt: "asc" },
    select: { id: true, categoryId: true },
  });
}
