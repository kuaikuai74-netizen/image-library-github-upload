import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { requireAssetPermission } from "@/lib/auth/server";
import { assetIdSchema } from "@/lib/assets/upload-schema";
import { restoreAsset } from "@/lib/assets/asset-service";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ assetId: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { assetId } = await params;
    const parsedAssetId = assetIdSchema.parse(assetId);
    const asset = await prisma.asset.findUnique({ where: { id: parsedAssetId }, select: { uploadedById: true } });
    const user = await requireAssetPermission("edit", asset?.uploadedById ?? undefined);
    return success(await restoreAsset(parsedAssetId, user.id));
  } catch (error) {
    return routeFailure(error);
  }
}
