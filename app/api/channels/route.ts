import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { requireAssetPermission } from "@/lib/auth/server";
import { listChannels } from "@/lib/library/repository";

export async function GET() {
  try {
    await requireAssetPermission("read");
    return success(await listChannels());
  } catch (error) {
    return routeFailure(error);
  }
}
