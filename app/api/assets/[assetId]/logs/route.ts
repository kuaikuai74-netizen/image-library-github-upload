import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { requireAssetPermission } from "@/lib/auth/server";
import { assetIdSchema } from "@/lib/assets/upload-schema";
import { getManagedAsset, listAssetLogs } from "@/lib/assets/asset-service";

type RouteContext = { params: Promise<{ assetId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { assetId } = await params;
    const parsedAssetId = assetIdSchema.parse(assetId);
    const asset = await getManagedAsset(parsedAssetId);
    await requireAssetPermission("edit", asset.uploadedById ?? undefined);
    return success(await listAssetLogs(parsedAssetId));
  } catch (error) {
    return routeFailure(error);
  }
}
