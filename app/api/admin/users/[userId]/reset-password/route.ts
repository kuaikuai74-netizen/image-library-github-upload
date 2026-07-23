import { z } from "zod";
import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { requireCurrentUser } from "@/lib/auth/server";
import { hashPassword } from "@/lib/auth/password";
import { UploadError } from "@/lib/assets/upload-errors";
import { assetIdSchema } from "@/lib/assets/upload-schema";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ userId: string }> };

const resetPasswordSchema = z.object({ password: z.string().min(8).max(128) });

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const actor = await requireCurrentUser();
    if (actor.role !== "SUPER_ADMIN") throw new UploadError("FORBIDDEN", "无权重置密码。", 403);
    const { userId } = await params;
    const parsedUserId = assetIdSchema.parse(userId);
    const input = resetPasswordSchema.parse(await request.json());
    const existing = await prisma.user.findUnique({ where: { id: parsedUserId }, select: { id: true } });
    if (!existing) throw new UploadError("USER_NOT_FOUND", "用户不存在。", 404);

    await prisma.$transaction(async (transaction) => {
      await transaction.user.update({ where: { id: parsedUserId }, data: { passwordHash: await hashPassword(input.password) } });
      await transaction.auditLog.create({ data: { actorId: actor.id, action: "USER_PASSWORD_RESET", objectType: "User", objectId: parsedUserId } });
    });
    return success({ userId: parsedUserId });
  } catch (error) {
    return routeFailure(error);
  }
}
