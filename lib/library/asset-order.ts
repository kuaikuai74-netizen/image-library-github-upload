import type { Prisma } from "@prisma/client";

export const assetOrderBy: Prisma.AssetOrderByWithRelationInput[] = [{ sortOrder: "asc" }, { createdAt: "desc" }];
