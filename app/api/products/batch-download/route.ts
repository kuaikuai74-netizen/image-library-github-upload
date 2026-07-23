import { z } from "zod";
import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { requireAssetPermission } from "@/lib/auth/server";
import { productBatchDownloadSchema } from "@/lib/assets/asset-schema";
import { UploadError } from "@/lib/assets/upload-service";
import { listDownloadableProductAssets } from "@/lib/assets/asset-service";
import { batchClientInfo, createDownloadBatch, executeDownloadBatch } from "@/lib/assets/download-batch-service";
import { createZipStream, downloadHeaders, nodeStreamResponse } from "@/lib/assets/download-service";
import { assetIdSchema } from "@/lib/assets/upload-schema";

const downloadQuerySchema = z.object({ batchId: assetIdSchema });

export async function POST(request: Request) {
  try {
    const user = await requireAssetPermission("download");
    const parsed = productBatchDownloadSchema.parse(await request.json());
    const assets = await listDownloadableProductAssets(parsed.productIds, { channelId: parsed.channelId, categoryId: parsed.categoryId });
    if (!assets.length) throw new UploadError("NO_DOWNLOADABLE_ASSETS", "所选素材库没有可下载的图片。", 404);
    const batch = await createDownloadBatch({
      actorId: user.id,
      type: "PRODUCTS",
      zipFilename: "product-libraries-download.zip",
      items: assets.map((asset) => ({ assetId: asset.id, status: "READY", filename: asset.filename, archivePath: asset.archivePath, errorCode: null })),
      scope: { productIds: parsed.productIds, channelId: parsed.channelId ?? null, categoryId: parsed.categoryId ?? null },
    });
    return success({ totalAssets: batch.readyCount, downloadUrl: `/api/products/batch-download?batchId=${batch.id}`, batchId: batch.id });
  } catch (error) {
    return routeFailure(error);
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireAssetPermission("download");
    const searchParams = new URL(request.url).searchParams;
    const { batchId } = downloadQuerySchema.parse({ batchId: searchParams.get("batchId") ?? "" });
    const prepared = await executeDownloadBatch(batchId, user.id, batchClientInfo(request));
    return nodeStreamResponse(createZipStream(prepared.assets, prepared.failedItems), downloadHeaders(prepared.batch.zipFilename, "application/zip"));
  } catch (error) {
    return routeFailure(error);
  }
}
