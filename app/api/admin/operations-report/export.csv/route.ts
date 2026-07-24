import { routeFailure } from "@/lib/api/route-helpers";
import { exportAdminOperationsReportCsv, parseAdminOperationsReportFilters } from "@/lib/admin/operations-report";
import { requireSuperAdmin } from "@/lib/auth/server";

export async function GET(request: Request) {
  try {
    await requireSuperAdmin();
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
