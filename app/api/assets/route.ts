import { success } from "@/lib/api/response";
import { parseQuery, routeFailure } from "@/lib/api/route-helpers";
import { requireAssetPermission } from "@/lib/auth/server";
import { listAssets } from "@/lib/library/repository";
import { assetQuerySchema } from "@/lib/library/query-schema";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    await requireAssetPermission("read");
    return success(await listAssets(parseQuery(assetQuerySchema, request.nextUrl.searchParams)));
  } catch (error) {
    return routeFailure(error);
  }
}
