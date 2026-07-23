import type { NextRequest } from "next/server";
import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { requireAssetPermission } from "@/lib/auth/server";
import { UploadError, uploadFiles } from "@/lib/assets/upload-service";
import { parseUploadMetadataField, uploadRequestSchema } from "@/lib/assets/upload-schema";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const metadata = parseUploadMetadataField(formData.get("metadata"));
    const parsed = uploadRequestSchema.parse({
      assetGroupId: formData.get("assetGroupId"),
      idempotencyKey: formData.get("idempotencyKey"),
      metadata,
    });
    const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
    if (files.length !== parsed.metadata.length) throw new UploadError("UPLOAD_FILE_METADATA_MISMATCH", "上传文件与元数据不匹配。");
    const user = await requireAssetPermission("upload");
    return success(await uploadFiles(parsed.assetGroupId, user.id, parsed.idempotencyKey, files.map((file, index) => ({ file, metadata: parsed.metadata[index] }))));
  } catch (error) {
    return routeFailure(error);
  }
}
