import { routeFailure } from "@/lib/api/route-helpers";
import { exportAdminAuditLogsCsv, parseAdminAuditLogFilters } from "@/lib/admin/audit-log-repository";
import { UploadError } from "@/lib/assets/upload-errors";
import { requireCurrentUser } from "@/lib/auth/server";

export async function GET(request: Request) {
  try {
    const actor = await requireCurrentUser();
    if (actor.role !== "SUPER_ADMIN") throw new UploadError("FORBIDDEN", "无权导出审计日志。", 403);
    const filters = parseAdminAuditLogFilters(Object.fromEntries(new URL(request.url).searchParams.entries()));
    const csv = await exportAdminAuditLogsCsv(filters);
    const filename = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
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
