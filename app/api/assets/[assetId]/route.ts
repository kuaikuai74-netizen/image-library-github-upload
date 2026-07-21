import type { NextRequest } from "next/server";
import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { requireAssetPermission } from "@/lib/auth/server";
import { assetIdSchema } from "@/lib/assets/upload-schema";
import { assetMutationSchema } from "@/lib/assets/asset-schema";
import { getManagedAsset, softDeleteAsset, updateAsset } from "@/lib/assets/asset-service";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ assetId: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { assetId } = await params;
    const parsedAssetId = assetIdSchema.parse(assetId);
    const asset = await getManagedAsset(parsedAssetId);
    await requireAssetPermission("read", asset.uploadedById ?? undefined);
    return success({
      id: asset.id,
      assetGroupId: asset.assetGroupId,
      assetType: asset.assetType,
      sortOrder: asset.sortOrder,
      color: asset.color,
      notes: asset.notes,
      status: asset.status,
      originalFilename: asset.originalFilename,
      sha256: asset.fileObject.sha256,
      width: asset.fileObject.width,
      height: asset.fileObject.height,
      fileSizeBytes: asset.fileObject.fileSizeBytes,
      mimeType: asset.fileObject.mimeType,
      uploadedBy: asset.uploadedBy,
      assetGroup: { id: asset.assetGroup.id, channelName: asset.assetGroup.channel.name, categoryName: asset.assetGroup.category.name, spu: asset.assetGroup.product.spu, countryCode: asset.assetGroup.countryCode, assetType: asset.assetGroup.assetType },
    });
  } catch (error) {
    return routeFailure(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { assetId } = await params;
    const parsedAssetId = assetIdSchema.parse(assetId);
    const asset = await prisma.asset.findUnique({ where: { id: parsedAssetId }, select: { uploadedById: true } });
    const user = await requireAssetPermission("edit", asset?.uploadedById ?? undefined);
    return success(await updateAsset(parsedAssetId, user.id, assetMutationSchema.parse(await request.json())));
  } catch (error) {
    return routeFailure(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { assetId } = await params;
    const parsedAssetId = assetIdSchema.parse(assetId);
    const asset = await prisma.asset.findUnique({ where: { id: parsedAssetId }, select: { uploadedById: true } });
    const user = await requireAssetPermission("delete", asset?.uploadedById ?? undefined);
    await softDeleteAsset(parsedAssetId, user.id);
    return success({ assetId: parsedAssetId, deletedBy: user.id });
  } catch (error) {
    return routeFailure(error);
  }
}
