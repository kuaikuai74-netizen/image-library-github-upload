import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { requireSuperAdmin } from "@/lib/auth/server";
import { listAdminOnlineMessages } from "@/lib/messages/repository";

export async function GET() {
  try {
    await requireSuperAdmin();
    return success(await listAdminOnlineMessages());
  } catch (error) {
    return routeFailure(error);
  }
}
