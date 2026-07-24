import { routeFailure } from "@/lib/api/route-helpers";
import { exportAdminDataQualityCsv, parseAdminDataQualityFilters } from "@/lib/admin/data-quality";
import { requireSuperAdmin } from "@/lib/auth/server";

export async function GET(request: Request) {
  try {
    await requireSuperAdmin();
    const filters = parseAdminDataQualityFilters(Object.fromEntries(new URL(request.url).searchParams.entries()));
    const csv = await exportAdminDataQualityCsv(filters);
    const filename = `data-quality-${new Date().toISOString().slice(0, 10)}.csv`;
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
