import { z } from "zod";
import { archiveUploadContextSchema } from "./upload-schema";

export const archiveUploadRequestSchema = archiveUploadContextSchema.extend({
  idempotencyKey: z.string().uuid(),
});

export type ArchiveUploadRequest = z.infer<typeof archiveUploadRequestSchema>;
