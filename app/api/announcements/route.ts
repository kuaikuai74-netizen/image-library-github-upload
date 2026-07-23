import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { requireCurrentUser } from "@/lib/auth/server";
import { getVisibleAnnouncements } from "@/lib/content/repository";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    return success(await getVisibleAnnouncements(user));
  } catch (error) {
    return routeFailure(error);
  }
}
