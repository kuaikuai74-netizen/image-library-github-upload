import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { failure } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { requireAssetPermission } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { getStorageService } from "@/lib/storage";
import { assetIdSchema } from "@/lib/assets/upload-schema";

type RouteContext = { params: Promise<{ assetId: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requireAssetPermission("read");
    const { assetId } = await params;
    const parsedAssetId = assetIdSchema.parse(assetId);
    const variant = request.nextUrl.searchParams.get("variant") ?? "original";
    if (variant !== "original" && variant !== "thumbnail" && variant !== "preview") return failure("INVALID_VARIANT", "图片变体无效。", 400);
    const asset = await prisma.asset.findFirst({ where: { id: parsedAssetId, status: "ACTIVE" }, include: { fileObject: true } });
    if (!asset) return failure("ASSET_NOT_FOUND", "素材不存在或不可访问。", 404);
    if (asset.fileObject.status !== "ACTIVE") return failure("FILE_NOT_FOUND", "文件不存在。", 404);
    const storageKey = variant === "original" ? asset.fileObject.originalStorageKey : variant === "thumbnail" ? asset.fileObject.thumbnailStorageKey : asset.fileObject.previewStorageKey;
    if (!storageKey) return failure("VARIANT_NOT_FOUND", "图片变体不存在。", 404);
    const file = await getStorageService().get(storageKey);
    if (!file) return failure("FILE_NOT_FOUND", "文件不存在。", 404);
    const contentType = variant === "original" ? asset.fileObject.mimeType : "image/webp";
    return new Response(Readable.toWeb(file.body) as ReadableStream, { headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=3600" } });
  } catch (error) {
    return routeFailure(error);
  }
}
