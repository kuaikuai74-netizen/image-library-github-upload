import { z } from "zod";
import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { requireAssetPermission } from "@/lib/auth/server";
import { assetIdsSchema } from "@/lib/assets/asset-schema";
import { prepareBatchDownload } from "@/lib/assets/asset-service";
import { batchClientInfo, createDownloadBatch, executeDownloadBatch } from "@/lib/assets/download-batch-service";
import { createZipStream, downloadHeaders, nodeStreamResponse } from "@/lib/assets/download-service";
import { assetIdSchema } from "@/lib/assets/upload-schema";

const downloadQuerySchema = z.object({ batchId: assetIdSchema });

export async function POST(request: Request) {
  try {
    const user = await requireAssetPermission("download");
    const { assetIds } = assetIdsSchema.parse(await request.json());
    const prepared = await prepareBatchDownload(assetIds);
    const batch = await createDownloadBatch({
      actorId: user.id,
      type: "ASSETS",
      zipFilename: "image-library-download.zip",
      items: prepared.items.map((item) => ({ assetId: item.assetId, status: item.status, filename: item.filename, errorCode: item.errorCode })),
      scope: { assetIds },
    });
    return success({ items: batch.items, downloadUrl: batch.readyIds.length ? `/api/assets/batch-download?batchId=${batch.id}` : null, batchId: batch.id });
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
