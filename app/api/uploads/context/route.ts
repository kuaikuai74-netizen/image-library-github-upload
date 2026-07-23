import type { NextRequest } from "next/server";
import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { requireAssetPermission } from "@/lib/auth/server";
import { ensureAssetGroup } from "@/lib/assets/asset-group-service";
import { contextUploadRequestSchema, parseUploadMetadataField } from "@/lib/assets/upload-schema";
import { UploadError, uploadFiles } from "@/lib/assets/upload-service";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const metadata = parseUploadMetadataField(formData.get("metadata"));
    const parsed = contextUploadRequestSchema.parse({
      channelId: formData.get("channelId"),
      categoryId: formData.get("categoryId"),
      spu: formData.get("spu"),
      countryCode: formData.get("countryCode"),
      assetType: formData.get("assetType"),
      idempotencyKey: formData.get("idempotencyKey"),
      metadata,
    });
    const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
    if (files.length !== parsed.metadata.length) throw new UploadError("UPLOAD_FILE_METADATA_MISMATCH", "上传文件与元数据不匹配。");
    if (parsed.metadata.some((metadataItem) => metadataItem.assetType !== parsed.assetType)) throw new UploadError("UPLOAD_ASSET_TYPE_MISMATCH", "图片素材组必须与上传上下文一致。");

    const user = await requireAssetPermission("upload");
    const assetGroup = await ensureAssetGroup({
      channelId: parsed.channelId,
      categoryId: parsed.categoryId,
      spu: parsed.spu,
      countryCode: parsed.countryCode,
      assetType: parsed.assetType,
    });
    return success({ assetGroupId: assetGroup.id, ...(await uploadFiles(assetGroup.id, user.id, parsed.idempotencyKey, files.map((file, index) => ({ file, metadata: parsed.metadata[index] })))) });
  } catch (error) {
    return routeFailure(error);
  }
}
