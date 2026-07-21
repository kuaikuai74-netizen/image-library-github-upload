import { z } from "zod";
import { assetIdSchema } from "./upload-schema";

export const assetMutationSchema = z.object({
  assetType: z.string().trim().min(1).max(64).optional(),
  sortOrder: z.coerce.number().int().min(1).max(10_000).optional(),
  color: z.string().trim().min(1).max(64).optional(),
  notes: z.string().trim().max(2_000).optional(),
  assetGroupId: assetIdSchema.optional(),
}).refine((value) => Object.values(value).some((item) => item !== undefined), "至少提供一个待修改字段。");

export const assetIdsSchema = z.object({
  assetIds: z.array(assetIdSchema).min(1).max(50).transform((ids) => [...new Set(ids)]),
});

export const recycleQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

export type AssetMutation = z.infer<typeof assetMutationSchema>;
