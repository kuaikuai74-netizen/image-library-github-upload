import { z } from "zod";
import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { requireAssetPermission } from "@/lib/auth/server";
import { assetIdsSchema } from "@/lib/assets/asset-schema";
import { UploadError } from "@/lib/assets/upload-service";
import { getDownloadableAsset, logDownload, prepareBatchDownload } from "@/lib/assets/asset-service";
import { createZipStream, downloadHeaders, nodeStreamResponse } from "@/lib/assets/download-service";

const downloadQuerySchema = z.object({ assetId: z.array(z.string()).min(1).max(50) });

export async function POST(request: Request) {
  try {
    const user = await requireAssetPermission("download");
    const { assetIds } = assetIdsSchema.parse(await request.json());
    const prepared = await prepareBatchDownload(assetIds, user.id);
    const params = new URLSearchParams();
    prepared.readyIds.forEach((assetId) => params.append("assetId", assetId));
    return success({ items: prepared.items, downloadUrl: prepared.readyIds.length ? `/api/assets/batch-download?${params.toString()}` : null });
  } catch (error) {
    return routeFailure(error);
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireAssetPermission("download");
    const searchParams = new URL(request.url).searchParams;
    const { assetId: assetIds } = downloadQuerySchema.parse({ assetId: searchParams.getAll("assetId") });
    const results = await Promise.all(assetIds.map(async (assetId) => {
      try {
        return await getDownloadableAsset(assetId);
      } catch {
        return null;
      }
    }));
    const assets = results.filter((asset): asset is NonNullable<typeof asset> => asset !== null);
    if (!assets.length) throw new UploadError("NO_DOWNLOADABLE_ASSETS", "没有可下载的素材。", 404);
    await Promise.all(assets.map((asset) => logDownload(asset.id, user.id)));
    return nodeStreamResponse(createZipStream(assets), downloadHeaders("image-library-download.zip", "application/zip"));
  } catch (error) {
    return routeFailure(error);
  }
}
