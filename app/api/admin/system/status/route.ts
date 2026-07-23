import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { getAdminSystemStatus } from "@/lib/admin/system-status";
import { UploadError } from "@/lib/assets/upload-errors";
import { requireCurrentUser } from "@/lib/auth/server";

export async function GET() {
  try {
    const actor = await requireCurrentUser();
    if (actor.role !== "SUPER_ADMIN") throw new UploadError("FORBIDDEN", "无权查看系统自检。", 403);
    return success(await getAdminSystemStatus());
  } catch (error) {
    return routeFailure(error);
  }
}
