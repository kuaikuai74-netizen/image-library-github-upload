import { routeFailure } from "@/lib/api/route-helpers";
import { requireSuperAdmin } from "@/lib/auth/server";
import { exportAdminDownloadBatchesCsv, parseAdminDownloadBatchFilters } from "@/lib/admin/download-batch-repository";

export async function GET(request: Request) {
  try {
    await requireSuperAdmin();
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
