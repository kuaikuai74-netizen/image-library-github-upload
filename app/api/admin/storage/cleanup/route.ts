import { z } from "zod";
import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { cleanupPendingFileObjects } from "@/lib/admin/storage-health";
import { UploadError } from "@/lib/assets/upload-errors";
import { requireCurrentUser } from "@/lib/auth/server";

const cleanupSchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
});

export async function POST(request: Request) {
  try {
    const actor = await requireCurrentUser();
    if (actor.role !== "SUPER_ADMIN") throw new UploadError("FORBIDDEN", "无权执行存储清理。", 403);
    const parsed = cleanupSchema.parse(await request.json().catch(() => ({})));
    return success(await cleanupPendingFileObjects(parsed.limit));
  } catch (error) {
    return routeFailure(error);
  }
}
