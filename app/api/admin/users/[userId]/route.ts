import { Prisma } from "@prisma/client";
import { z } from "zod";
import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { requireCurrentUser } from "@/lib/auth/server";
import { userRoles, userStatuses } from "@/lib/auth/roles";
import { UploadError } from "@/lib/assets/upload-errors";
import { assetIdSchema } from "@/lib/assets/upload-schema";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ userId: string }> };

const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().email().max(160).transform((value) => value.toLowerCase()).optional(),
  username: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/).optional(),
  role: z.enum(userRoles).optional(),
  status: z.enum(userStatuses).optional(),
}).refine((value) => Object.values(value).some((item) => item !== undefined), "至少提供一个待修改字段。");

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const actor = await requireCurrentUser();
    if (actor.role !== "SUPER_ADMIN") throw new UploadError("FORBIDDEN", "无权修改用户。", 403);
    const { userId } = await params;
    const parsedUserId = assetIdSchema.parse(userId);
    const input = updateUserSchema.parse(await request.json());
    if (parsedUserId === actor.id && input.status === "DISABLED") throw new UploadError("CANNOT_DISABLE_SELF", "不能禁用当前登录的超级管理员账号。", 409);

    const existing = await prisma.user.findUnique({ where: { id: parsedUserId }, select: { id: true, role: true, status: true } });
    if (!existing) throw new UploadError("USER_NOT_FOUND", "用户不存在。", 404);
    const action = input.status && input.status !== existing.status ? "USER_STATUS_CHANGED" : "USER_UPDATED";
    const user = await prisma.$transaction(async (transaction) => {
      const updatedUser = await transaction.user.update({
        where: { id: parsedUserId },
        data: input,
        select: { id: true, name: true, email: true, username: true, role: true, status: true, createdAt: true },
      });
      await transaction.auditLog.create({ data: { actorId: actor.id, action, objectType: "User", objectId: updatedUser.id, details: { changes: input } } });
      return updatedUser;
    });
    return success(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return routeFailure(new UploadError("USER_ALREADY_EXISTS", "邮箱或用户名已存在。", 409));
    }
    return routeFailure(error);
  }
}
