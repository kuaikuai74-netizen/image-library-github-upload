import { z } from "zod";
import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { requireAssetPermission } from "@/lib/auth/server";
import { productBatchDownloadSchema } from "@/lib/assets/asset-schema";
import { UploadError } from "@/lib/assets/upload-service";
import { listDownloadableProductAssets, logBatchDownloadAssets } from "@/lib/assets/asset-service";
import { createZipStream, downloadHeaders, nodeStreamResponse } from "@/lib/assets/download-service";
import { assetIdSchema } from "@/lib/assets/upload-schema";

const downloadQuerySchema = z.object({
  productId: z.array(assetIdSchema).min(1).max(50).transform((ids) => [...new Set(ids)]),
  channelId: assetIdSchema.optional(),
  categoryId: assetIdSchema.optional(),
});

export async function POST(request: Request) {
  try {
    await requireAssetPermission("download");
    const parsed = productBatchDownloadSchema.parse(await request.json());
    const assets = await listDownloadableProductAssets(parsed.productIds, { channelId: parsed.channelId, categoryId: parsed.categoryId });
    if (!assets.length) throw new UploadError("NO_DOWNLOADABLE_ASSETS", "所选素材库没有可下载的图片。", 404);
    const params = new URLSearchParams();
    parsed.productIds.forEach((productId) => params.append("productId", productId));
    if (parsed.channelId) params.set("channelId", parsed.channelId);
    if (parsed.categoryId) params.set("categoryId", parsed.categoryId);
    return success({ totalAssets: assets.length, downloadUrl: `/api/products/batch-download?${params.toString()}` });
  } catch (error) {
    return routeFailure(error);
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireAssetPermission("download");
    const searchParams = new URL(request.url).searchParams;
    const parsed = downloadQuerySchema.parse({
      productId: searchParams.getAll("productId"),
      channelId: searchParams.get("channelId") ?? undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
    });
    const assets = await listDownloadableProductAssets(parsed.productId, { channelId: parsed.channelId, categoryId: parsed.categoryId });
    if (!assets.length) throw new UploadError("NO_DOWNLOADABLE_ASSETS", "所选素材库没有可下载的图片。", 404);
    await logBatchDownloadAssets(assets.map((asset) => asset.id), user.id);
    return nodeStreamResponse(createZipStream(assets), downloadHeaders("product-libraries-download.zip", "application/zip"));
  } catch (error) {
    return routeFailure(error);
  }
}
