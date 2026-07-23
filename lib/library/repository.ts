import type { Prisma } from "@prisma/client";
import type { AssetFilters, AssetGroupPage, CategoryListItem, ChannelListItem, LibraryAsset, Paginated, ProductListItem } from "@/lib/library/contracts";
import type { AssetQuery } from "@/lib/library/query-schema";
import { assetOrderBy } from "@/lib/library/asset-order";
import { summarizeProductGroupsByCategory } from "@/lib/library/product-groups";
import { prisma } from "@/lib/prisma";

const assetInclude = {
  assetGroup: {
    select: {
      channelId: true,
      categoryId: true,
      countryCode: true,
      assetType: true,
      product: { select: { spu: true } },
    },
  },
  fileObject: true,
} satisfies Prisma.AssetInclude;

function groupWhere(query: AssetQuery): Prisma.AssetGroupWhereInput {
  const productFilter: Prisma.ProductWhereInput | undefined = query.spu ? { spu: { equals: query.spu, mode: "insensitive" } } : undefined;
  return {
    channelId: query.channelId,
    categoryId: query.categoryId,
    countryCode: query.countryCode,
    assetType: undefined,
    product: productFilter ? { is: productFilter } : undefined,
  };
}

function assetWhere(query: AssetQuery): Prisma.AssetWhereInput {
  const group = groupWhere(query);
  const searchTerms: Prisma.AssetWhereInput[] = [];
  if (query.filename) searchTerms.push({ filename: { contains: query.filename, mode: "insensitive" } });
  if (query.q) {
    searchTerms.push(
      { filename: { contains: query.q, mode: "insensitive" } },
      { sku: { contains: query.q, mode: "insensitive" } },
      { assetGroup: { is: { product: { is: { spu: { contains: query.q, mode: "insensitive" } } } } } },
    );
  }

  return {
    status: "ACTIVE",
    color: query.color ? { equals: query.color, mode: "insensitive" } : undefined,
    assetType: query.assetType ? { equals: query.assetType, mode: "insensitive" } : undefined,
    assetGroup: { is: group },
    ...(searchTerms.length ? { OR: searchTerms } : {}),
  };
}

function mapAsset(asset: Prisma.AssetGetPayload<{ include: typeof assetInclude }>): LibraryAsset {
  return {
    id: asset.id,
    assetGroupId: asset.assetGroupId,
    fileObjectId: asset.fileObjectId,
    uploadedById: asset.uploadedById,
    channelId: asset.assetGroup.channelId,
    categoryId: asset.assetGroup.categoryId,
    countryCode: asset.assetGroup.countryCode,
    assetType: asset.assetType,
    color: asset.color,
    spu: asset.assetGroup.product.spu,
    sku: asset.sku,
    order: asset.sortOrder,
    width: asset.fileObject.width,
    height: asset.fileObject.height,
    fileSizeBytes: asset.fileObject.fileSizeBytes,
    filename: asset.filename,
    notes: asset.notes,
    thumbnailUrl: asset.fileObject.thumbnailStorageKey ? `/api/assets/${asset.id}/content?variant=thumbnail` : null,
    previewUrl: asset.fileObject.previewStorageKey ? `/api/assets/${asset.id}/content?variant=preview` : null,
    previewSlot: asset.previewSlot,
  };
}

export async function listChannels(): Promise<ChannelListItem[]> {
  const channels = await prisma.channel.findMany({ orderBy: { name: "asc" }, include: { assetGroups: { select: { _count: { select: { assets: { where: { status: "ACTIVE" } } } } } } } });
  return channels.map((channel) => ({
    id: channel.id,
    name: channel.name,
    assetCount: channel.assetGroups.reduce((total, group) => total + group._count.assets, 0),
  }));
}

export async function listCategories(channelId?: string): Promise<CategoryListItem[]> {
  const groups = await prisma.assetGroup.findMany({
    where: channelId ? { channelId } : undefined,
    select: { categoryId: true, productId: true, _count: { select: { assets: { where: { status: "ACTIVE" } } } } },
  });
  const totals = summarizeProductGroupsByCategory(groups.map((group) => ({ categoryId: group.categoryId, productId: group.productId, assetCount: group._count.assets })));
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    previewSlot: category.previewSlot,
    assetGroupCount: totals.get(category.id)?.assetGroupCount ?? 0,
    assetCount: totals.get(category.id)?.assetCount ?? 0,
  }));
}

export async function listProducts(query: Pick<AssetQuery, "channelId" | "categoryId" | "spu" | "q" | "page" | "pageSize">): Promise<Paginated<ProductListItem>> {
  const groupFilter: Prisma.AssetGroupWhereInput = {
    channelId: query.channelId,
    categoryId: query.categoryId,
    assets: { some: { status: "ACTIVE" } },
  };
  const searchGroupFilter: Prisma.AssetGroupWhereInput = {
    channelId: query.channelId,
    categoryId: query.categoryId,
    assets: { some: { status: "ACTIVE", OR: [{ filename: { contains: query.q, mode: "insensitive" } }, { sku: { contains: query.q, mode: "insensitive" } }] } },
  };
  const where: Prisma.ProductWhereInput = {
    categoryId: query.categoryId,
    assetGroups: { some: groupFilter },
    ...(query.spu ? { spu: { equals: query.spu, mode: "insensitive" } } : {}),
    ...(!query.spu && query.q ? { OR: [{ spu: { contains: query.q, mode: "insensitive" } }, { name: { contains: query.q, mode: "insensitive" } }, { category: { is: { name: { contains: query.q, mode: "insensitive" } } } }, { assetGroups: { some: searchGroupFilter } }] } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      include: {
        category: { select: { previewSlot: true } },
        assetGroups: {
          where: groupFilter,
          select: {
            _count: { select: { assets: { where: { status: "ACTIVE" } } } },
            assets: {
              where: { status: "ACTIVE" },
              select: { id: true, fileObject: { select: { thumbnailStorageKey: true } } },
              orderBy: { sortOrder: "asc" },
              take: 1,
            },
          },
        },
      },
      orderBy: { spu: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.product.count({ where }),
  ]);
  return {
    items: items.map((product) => {
      const firstAsset = product.assetGroups.flatMap((group) => group.assets).find((asset) => asset.fileObject.thumbnailStorageKey);
      return {
        id: product.id,
        spu: product.spu,
        name: product.name,
        categoryId: product.categoryId,
        assetCount: product.assetGroups.reduce((sum, group) => sum + group._count.assets, 0),
        thumbnailUrl: firstAsset ? `/api/assets/${firstAsset.id}/content?variant=thumbnail` : null,
        previewSlot: product.category.previewSlot,
      };
    }),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function listAssetGroups(query: Pick<AssetQuery, "channelId" | "categoryId" | "countryCode" | "assetType" | "spu" | "page" | "pageSize">): Promise<AssetGroupPage> {
  const where = groupWhere({ ...query, color: undefined, filename: undefined, q: undefined });
  const [items, total, productGroups] = await prisma.$transaction([
    prisma.assetGroup.findMany({
      where,
      include: { channel: { select: { name: true } }, category: { select: { name: true } }, product: { select: { id: true, spu: true, name: true, categoryId: true } }, _count: { select: { assets: { where: { status: "ACTIVE" } } } } },
      orderBy: { updatedAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.assetGroup.count({ where }),
    prisma.assetGroup.findMany({
      where: { ...where, assets: { some: { status: "ACTIVE" } } },
      distinct: ["productId"],
      select: { productId: true },
    }),
  ]);
  return {
    items: items.map((group) => ({
      id: group.id,
      channelId: group.channelId,
      channelName: group.channel.name,
      categoryId: group.categoryId,
      categoryName: group.category.name,
      countryCode: group.countryCode,
      assetType: group.assetType,
      product: group.product,
      assetCount: group._count.assets,
    })),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    productGroupTotal: productGroups.length,
  };
}

export async function listAssets(query: AssetQuery): Promise<Paginated<LibraryAsset>> {
  const where = assetWhere(query);
  const [items, total] = await prisma.$transaction([
    prisma.asset.findMany({
      where,
      include: assetInclude,
      orderBy: assetOrderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.asset.count({ where }),
  ]);
  return { items: items.map(mapAsset), page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) };
}

export async function listAssetFilters(query: Pick<AssetQuery, "channelId" | "categoryId" | "spu">): Promise<AssetFilters> {
  const scopedGroup = groupWhere({ ...query, countryCode: undefined, assetType: undefined, color: undefined, filename: undefined, q: undefined, page: 1, pageSize: 1 });
  const [countries, types, colors] = await prisma.$transaction([
    prisma.assetGroup.findMany({ where: scopedGroup, distinct: ["countryCode"], select: { countryCode: true }, take: 100 }),
    prisma.asset.findMany({ where: { status: "ACTIVE", assetGroup: { is: scopedGroup } }, distinct: ["assetType"], select: { assetType: true }, take: 100 }),
    prisma.asset.findMany({ where: { status: "ACTIVE", assetGroup: { is: scopedGroup } }, distinct: ["color"], select: { color: true }, take: 100 }),
  ]);
  return {
    countries: countries.map((item) => item.countryCode).sort(),
    assetTypes: types.map((item) => item.assetType).sort(),
    colors: colors.map((item) => item.color).sort(),
  };
}
