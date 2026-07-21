import { z } from "zod";

export const credentialsSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(256),
});

export function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLocaleLowerCase("en-US");
}
