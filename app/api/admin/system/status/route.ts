import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { getAdminSystemStatus } from "@/lib/admin/system-status";
import { requireSuperAdmin } from "@/lib/auth/server";

export async function GET() {
  try {
    await requireSuperAdmin();
    return success(await getAdminSystemStatus());
  } catch (error) {
    return routeFailure(error);
  }
}
