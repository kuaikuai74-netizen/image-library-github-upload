import { routeFailure } from "@/lib/api/route-helpers";
import { requireCurrentUser } from "@/lib/auth/server";
import { UploadError } from "@/lib/assets/upload-errors";
import { exportAdminDownloadBatchesCsv, parseAdminDownloadBatchFilters } from "@/lib/admin/download-batch-repository";

export async function GET(request: Request) {
  try {
    const actor = await requireCurrentUser();
    if (actor.role !== "SUPER_ADMIN") throw new UploadError("FORBIDDEN", "无权导出下载批次。", 403);
    const searchParams = new URL(request.url).searchParams;
    const filters = parseAdminDownloadBatchFilters(Object.fromEntries(searchParams.entries()));
    const csv = await exportAdminDownloadBatchesCsv(filters);
    const filename = `download-batches-${new Date().toISOString().slice(0, 10)}.csv`;
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
