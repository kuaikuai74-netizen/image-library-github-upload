import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { getAdminStorageHealth } from "@/lib/admin/storage-health";
import { requireSuperAdmin } from "@/lib/auth/server";

export async function GET() {
  try {
    await requireSuperAdmin();
    return success(await getAdminStorageHealth());
  } catch (error) {
    return routeFailure(error);
  }
}
