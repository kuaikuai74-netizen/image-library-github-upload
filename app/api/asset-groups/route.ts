import type { NextRequest } from "next/server";
import { success } from "@/lib/api/response";
import { parseQuery, routeFailure } from "@/lib/api/route-helpers";
import { requireAssetPermission } from "@/lib/auth/server";
import { listAssetGroups } from "@/lib/library/repository";
import { assetQuerySchema } from "@/lib/library/query-schema";

export async function GET(request: NextRequest) {
  try {
    await requireAssetPermission("read");
    const query = parseQuery(assetQuerySchema, request.nextUrl.searchParams);
    return success(await listAssetGroups(query));
  } catch (error) {
    return routeFailure(error);
  }
}
