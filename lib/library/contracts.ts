export type ChannelListItem = {
  id: string;
  name: string;
  assetCount: number;
};

export type CategoryListItem = {
  id: string;
  name: string;
  previewSlot: number;
  assetGroupCount: number;
  assetCount: number;
};

export type ProductReference = {
  id: string;
  spu: string;
  name: string;
  categoryId: string;
};

export type ProductListItem = ProductReference & {
  assetCount: number;
  thumbnailUrl: string | null;
  previewSlot: number;
};

export type AssetGroupListItem = {
  id: string;
  channelId: string;
  channelName: string;
  categoryId: string;
  categoryName: string;
  countryCode: string;
  assetType: string;
  product: ProductReference;
  assetCount: number;
};

export type AssetGroupPage = Paginated<AssetGroupListItem> & {
  productGroupTotal: number;
};

export type LibraryAsset = {
  id: string;
  assetGroupId: string;
  fileObjectId: string;
  uploadedById: string | null;
  channelId: string;
  categoryId: string;
  countryCode: string;
  assetType: string;
  color: string;
  spu: string;
  sku: string;
  order: number;
  width: number;
  height: number;
  fileSizeBytes: number;
  filename: string;
  notes: string;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  previewSlot: number;
};

export type AssetFilters = {
  countries: string[];
  assetTypes: string[];
  colors: string[];
};

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ApiSuccess<T> = { data: T };
export type ApiFailure = { error: { code: string; message: string } };
