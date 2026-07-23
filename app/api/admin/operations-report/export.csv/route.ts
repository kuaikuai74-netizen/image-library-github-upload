import { routeFailure } from "@/lib/api/route-helpers";
import { exportAdminOperationsReportCsv, parseAdminOperationsReportFilters } from "@/lib/admin/operations-report";
import { UploadError } from "@/lib/assets/upload-errors";
import { requireCurrentUser } from "@/lib/auth/server";

export async function GET(request: Request) {
  try {
    const actor = await requireCurrentUser();
    if (actor.role !== "SUPER_ADMIN") throw new UploadError("FORBIDDEN", "无权导出运营报表。", 403);
    const filters = parseAdminOperationsReportFilters(Object.fromEntries(new URL(request.url).searchParams.entries()));
    const csv = await exportAdminOperationsReportCsv(filters);
    const filename = `operations-report-${new Date().toISOString().slice(0, 10)}.csv`;
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
