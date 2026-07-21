import { routeFailure } from "@/lib/api/route-helpers";
import { requireAssetPermission } from "@/lib/auth/server";
import { assetIdSchema } from "@/lib/assets/upload-schema";
import { UploadError } from "@/lib/assets/upload-service";
import { getDownloadableAsset, logDownload } from "@/lib/assets/asset-service";
import { downloadHeaders, nodeStreamResponse } from "@/lib/assets/download-service";
import { getStorageService } from "@/lib/storage";

type RouteContext = { params: Promise<{ assetId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await requireAssetPermission("download");
    const { assetId } = await params;
    const asset = await getDownloadableAsset(assetIdSchema.parse(assetId));
    const object = await getStorageService().get(asset.fileObject.originalStorageKey);
    if (!object) throw new UploadError("FILE_NOT_FOUND", "文件不存在。", 404);
    await logDownload(asset.id, user.id);
    return nodeStreamResponse(object.body, downloadHeaders(asset.originalFilename, asset.fileObject.mimeType));
  } catch (error) {
    return routeFailure(error);
  }
}
