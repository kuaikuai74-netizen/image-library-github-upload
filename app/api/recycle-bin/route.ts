import type { NextRequest } from "next/server";
import { success } from "@/lib/api/response";
import { parseQuery, routeFailure } from "@/lib/api/route-helpers";
import { requireCurrentUser } from "@/lib/auth/server";
import { recycleQuerySchema } from "@/lib/assets/asset-schema";
import { listRecycleBin } from "@/lib/assets/asset-service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const query = parseQuery(recycleQuerySchema, request.nextUrl.searchParams);
    return success(await listRecycleBin(user.role, user.id, query.page, query.pageSize));
  } catch (error) {
    return routeFailure(error);
  }
}
