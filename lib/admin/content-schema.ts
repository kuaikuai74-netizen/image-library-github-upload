import { z } from "zod";
import { userRoles } from "@/lib/auth/roles";

export const announcementTypes = ["INFO", "MAINTENANCE", "POLICY", "ALERT"] as const;
export const contentStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

const roleSchema = z.enum(userRoles);
const uniqueRoles = (roles: Array<(typeof userRoles)[number]>) => [...new Set(roles)];

function nullableDateSchema(keepMissing: true): z.ZodPipe<z.ZodOptional<z.ZodAny>, z.ZodTransform<Date | null | undefined, unknown>>;
function nullableDateSchema(keepMissing?: false): z.ZodPipe<z.ZodOptional<z.ZodAny>, z.ZodTransform<Date | null, unknown>>;
function nullableDateSchema(keepMissing = false) {
  return z.any().optional().transform((value, context) => {
    if (value === undefined) return keepMissing ? undefined : null;
    if (value === null || value === "") return null;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      context.addIssue({ code: "custom", message: "时间格式无效。" });
      return z.NEVER;
    }
    return date;
  });
}

function assertTimeRange<T extends { startsAt?: Date | null; endsAt?: Date | null }>(value: T, context: z.RefinementCtx) {
  if (value.startsAt && value.endsAt && value.startsAt > value.endsAt) {
    context.addIssue({ code: "custom", path: ["endsAt"], message: "结束时间不能早于开始时间。" });
  }
}

export const announcementCreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(10_000),
  type: z.enum(announcementTypes).default("INFO"),
  status: z.enum(contentStatuses).default("DRAFT"),
  visibilityRoles: z.array(roleSchema).max(userRoles.length).optional().default([]).transform(uniqueRoles),
  pinned: z.boolean().default(false),
  startsAt: nullableDateSchema(),
  endsAt: nullableDateSchema(),
}).superRefine(assertTimeRange);

export const announcementUpdateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  body: z.string().trim().min(1).max(10_000).optional(),
  type: z.enum(announcementTypes).optional(),
  status: z.enum(contentStatuses).optional(),
  visibilityRoles: z.array(roleSchema).max(userRoles.length).optional().transform((roles) => roles ? uniqueRoles(roles) : undefined),
  pinned: z.boolean().optional(),
  startsAt: nullableDateSchema(true),
  endsAt: nullableDateSchema(true),
}).refine((value) => Object.values(value).some((item) => item !== undefined), "至少提供一个待修改字段。").superRefine(assertTimeRange);

export const documentCreateSchema = z.object({
  slug: z.string().trim().toLowerCase().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(20_000),
  category: z.string().trim().min(1).max(80),
  status: z.enum(contentStatuses).default("DRAFT"),
  visibilityRoles: z.array(roleSchema).max(userRoles.length).optional().default([]).transform(uniqueRoles),
  sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const documentUpdateSchema = z.object({
  slug: z.string().trim().toLowerCase().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  title: z.string().trim().min(1).max(160).optional(),
  body: z.string().trim().min(1).max(20_000).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  status: z.enum(contentStatuses).optional(),
  visibilityRoles: z.array(roleSchema).max(userRoles.length).optional().transform((roles) => roles ? uniqueRoles(roles) : undefined),
  sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
}).refine((value) => Object.values(value).some((item) => item !== undefined), "至少提供一个待修改字段。");
