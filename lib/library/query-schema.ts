import { z } from "zod";

const optionalId = z.string().trim().regex(/^[a-z0-9-]{3,128}$/).optional();
const optionalText = z.string().trim().min(1).max(120).optional();

export const assetQuerySchema = z.object({
  channelId: optionalId,
  categoryId: optionalId,
  countryCode: z.string().trim().toUpperCase().min(2).max(8).optional(),
  assetType: optionalText,
  color: optionalText,
  spu: optionalText,
  filename: optionalText,
  q: optionalText,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

export const listQuerySchema = assetQuerySchema.pick({ channelId: true, categoryId: true, spu: true, q: true, page: true, pageSize: true });

export type AssetQuery = z.infer<typeof assetQuerySchema>;

export function parseSearchParams(searchParams: URLSearchParams) {
  return Object.fromEntries(searchParams.entries());
}
