import { z } from "zod";
import type { NextRequest } from "next/server";
import { success } from "@/lib/api/response";
import { parseQuery, routeFailure } from "@/lib/api/route-helpers";
import { requireAssetPermission } from "@/lib/auth/server";
import { listCategories } from "@/lib/library/repository";

const categoryQuerySchema = z.object({ channelId: z.string().trim().regex(/^[a-z0-9-]{3,128}$/).optional() });

export async function GET(request: NextRequest) {
  try {
    await requireAssetPermission("read");
    const query = parseQuery(categoryQuerySchema, request.nextUrl.searchParams);
    return success(await listCategories(query.channelId));
  } catch (error) {
    return routeFailure(error);
  }
}
