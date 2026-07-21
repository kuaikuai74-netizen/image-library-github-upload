import { z } from "zod";

export const assetIdSchema = z.string().trim().regex(/^[a-z0-9-]{3,128}$/);

export const uploadMetadataSchema = z.object({
  assetType: z.string().trim().min(1).max(64),
  sortOrder: z.coerce.number().int().min(1).max(10_000),
});

export const uploadRequestSchema = z.object({
  assetGroupId: assetIdSchema,
  idempotencyKey: z.string().uuid(),
  metadata: z.array(uploadMetadataSchema).min(1).max(20),
});

export type UploadMetadata = z.infer<typeof uploadMetadataSchema>;
