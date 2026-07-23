import { routeFailure } from "@/lib/api/route-helpers";
import { exportAdminUploadTasksCsv, parseAdminUploadTaskFilters } from "@/lib/admin/upload-task-repository";
import { UploadError } from "@/lib/assets/upload-errors";
import { requireCurrentUser } from "@/lib/auth/server";

export async function GET(request: Request) {
  try {
    const actor = await requireCurrentUser();
    if (actor.role !== "SUPER_ADMIN") throw new UploadError("FORBIDDEN", "无权导出上传任务。", 403);
    const filters = parseAdminUploadTaskFilters(Object.fromEntries(new URL(request.url).searchParams.entries()));
    const csv = await exportAdminUploadTasksCsv(filters);
    const filename = `upload-tasks-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return routeFailure(error);
  }
}
