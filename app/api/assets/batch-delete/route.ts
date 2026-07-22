import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { hasAssetPermission } from "@/lib/auth/permissions";
import { requireCurrentUser } from "@/lib/auth/server";
import { assetIdsSchema } from "@/lib/assets/asset-schema";
import { softDeleteAsset } from "@/lib/assets/asset-service";
import { prisma } from "@/lib/prisma";

type BatchDeleteItem = {
  assetId: string;
  status: "DELETED" | "FAILED";
  errorCode: string | null;
};

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const { assetIds } = assetIdsSchema.parse(await request.json());
    const assets = await prisma.asset.findMany({
      where: { id: { in: assetIds }, status: "ACTIVE" },
      select: { id: true, uploadedById: true },
    });
    const byId = new Map(assets.map((asset) => [asset.id, asset]));
    const items: BatchDeleteItem[] = [];

    for (const assetId of assetIds) {
      const asset = byId.get(assetId);
      if (!asset) {
        items.push({ assetId, status: "FAILED", errorCode: "ASSET_NOT_FOUND" });
        continue;
      }
      if (!hasAssetPermission(user.role, "delete", { userId: user.id, uploadedById: asset.uploadedById ?? undefined })) {
        items.push({ assetId, status: "FAILED", errorCode: "FORBIDDEN" });
        continue;
      }
      try {
        await softDeleteAsset(assetId, user.id);
        items.push({ assetId, status: "DELETED", errorCode: null });
      } catch {
        items.push({ assetId, status: "FAILED", errorCode: "DELETE_FAILED" });
      }
    }

    return success({ items });
  } catch (error) {
    return routeFailure(error);
  }
}
