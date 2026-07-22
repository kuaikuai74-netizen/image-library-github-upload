import type { NextRequest } from "next/server";
import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { requireAssetPermission } from "@/lib/auth/server";
import { archiveUploadRequestSchema } from "@/lib/assets/archive-upload-schema";
import { uploadZipArchive } from "@/lib/assets/archive-upload-service";
import { UploadError } from "@/lib/assets/upload-service";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const parsed = archiveUploadRequestSchema.parse({
      channelId: formData.get("channelId"),
      categoryId: formData.get("categoryId"),
      spu: formData.get("spu"),
      assetType: formData.get("assetType"),
      idempotencyKey: formData.get("idempotencyKey"),
    });
    const archive = formData.get("archive");
    if (!(archive instanceof File)) throw new UploadError("ARCHIVE_REQUIRED", "请选择 ZIP 压缩包。");
    const user = await requireAssetPermission("upload");
    return success(await uploadZipArchive(parsed, user.id, archive));
  } catch (error) {
    return routeFailure(error);
  }
}
