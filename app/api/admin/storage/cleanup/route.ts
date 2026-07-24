import { z } from "zod";
import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { cleanupPendingFileObjects } from "@/lib/admin/storage-health";
import { requireSuperAdmin } from "@/lib/auth/server";

const cleanupSchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
});

export async function POST(request: Request) {
  try {
    await requireSuperAdmin();
    const parsed = cleanupSchema.parse(await request.json().catch(() => ({})));
    return success(await cleanupPendingFileObjects(parsed.limit));
  } catch (error) {
    return routeFailure(error);
  }
}
