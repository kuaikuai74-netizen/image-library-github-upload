import { routeFailure } from "@/lib/api/route-helpers";
import { UploadError } from "@/lib/assets/upload-errors";
import { requireCurrentUser } from "@/lib/auth/server";
import { exportAdminAssetGroupGovernanceCsv, parseAdminAssetGroupGovernanceFilters } from "@/lib/admin/asset-group-governance";

export async function GET(request: Request) {
  try {
    const actor = await requireCurrentUser();
    if (actor.role !== "SUPER_ADMIN") throw new UploadError("FORBIDDEN", "无权导出素材组治理清单。", 403);
    const filters = parseAdminAssetGroupGovernanceFilters(Object.fromEntries(new URL(request.url).searchParams.entries()));
    const csv = await exportAdminAssetGroupGovernanceCsv(filters);
    const filename = `asset-group-governance-${new Date().toISOString().slice(0, 10)}.csv`;
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
