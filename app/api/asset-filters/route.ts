import type { NextRequest } from "next/server";
import { success } from "@/lib/api/response";
import { parseQuery, routeFailure } from "@/lib/api/route-helpers";
import { requireAssetPermission } from "@/lib/auth/server";
import { listAssetFilters } from "@/lib/library/repository";
import { listQuerySchema } from "@/lib/library/query-schema";

export async function GET(request: NextRequest) {
  try {
    await requireAssetPermission("read");
    const query = parseQuery(listQuerySchema, request.nextUrl.searchParams);
    return success(await listAssetFilters(query));
  } catch (error) {
    return routeFailure(error);
  }
}
