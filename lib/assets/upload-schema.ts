import { z } from "zod";
import { UploadError } from "./upload-errors";
import { assetTypeOptions, countryOptions } from "../library/countries";

export const assetIdSchema = z.string().trim().regex(/^[a-z0-9-]{3,128}$/);

export const uploadMetadataSchema = z.object({
  assetType: z.string().trim().min(1).max(64),
  sortOrder: z.coerce.number().int().min(1).max(10_000),
  color: z.string().trim().min(1).max(64).optional(),
});

const countryCodeSchema = z.string().trim().refine((countryCode) => countryOptions.some((country) => country.code === countryCode), "请选择有效国家。");

export const uploadContextSchema = z.object({
  channelId: assetIdSchema,
  categoryId: assetIdSchema,
  spu: z.string().trim().min(1).max(120),
  countryCode: countryCodeSchema,
  assetType: z.enum(assetTypeOptions),
});

export const archiveUploadContextSchema = uploadContextSchema.omit({ countryCode: true });

export const uploadRequestSchema = z.object({
  assetGroupId: assetIdSchema,
  idempotencyKey: z.string().uuid(),
  metadata: z.array(uploadMetadataSchema).min(1).max(20),
});

export const contextUploadRequestSchema = uploadContextSchema.extend({
  idempotencyKey: z.string().uuid(),
  metadata: z.array(uploadMetadataSchema).min(1).max(20),
});

export function parseUploadMetadataField(value: FormDataEntryValue | null) {
  try {
    return JSON.parse(String(value ?? "[]")) as unknown;
  } catch {
    throw new UploadError("INVALID_UPLOAD_METADATA", "上传元数据无效。");
  }
}

export type UploadMetadata = z.infer<typeof uploadMetadataSchema>;
export type UploadContext = z.infer<typeof uploadContextSchema>;
