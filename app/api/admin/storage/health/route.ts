import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { getAdminStorageHealth } from "@/lib/admin/storage-health";
import { UploadError } from "@/lib/assets/upload-errors";
import { requireCurrentUser } from "@/lib/auth/server";

export async function GET() {
  try {
    const actor = await requireCurrentUser();
    if (actor.role !== "SUPER_ADMIN") throw new UploadError("FORBIDDEN", "无权查看存储健康状态。", 403);
    return success(await getAdminStorageHealth());
  } catch (error) {
    return routeFailure(error);
  }
}
