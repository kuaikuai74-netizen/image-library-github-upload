import { Prisma } from "@prisma/client";
import { z } from "zod";
import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { requireCurrentUser } from "@/lib/auth/server";
import { userRoles } from "@/lib/auth/roles";
import { hashPassword } from "@/lib/auth/password";
import { UploadError } from "@/lib/assets/upload-errors";
import { prisma } from "@/lib/prisma";

const createUserSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(160).transform((value) => value.toLowerCase()),
  username: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(8).max(128),
  role: z.enum(userRoles).default("VIEWER"),
});

export async function POST(request: Request) {
  try {
    const actor = await requireCurrentUser();
    if (actor.role !== "SUPER_ADMIN") throw new UploadError("FORBIDDEN", "无权创建用户。", 403);
    const input = createUserSchema.parse(await request.json());
    const { password, ...userInput } = input;
    const user = await prisma.$transaction(async (transaction) => {
      const createdUser = await transaction.user.create({
        data: { ...userInput, passwordHash: await hashPassword(password) },
        select: { id: true, name: true, email: true, username: true, role: true, status: true, createdAt: true },
      });
      await transaction.auditLog.create({ data: { actorId: actor.id, action: "USER_CREATED", objectType: "User", objectId: createdUser.id, details: { email: createdUser.email, role: createdUser.role } } });
      return createdUser;
    });
    return success(user, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return routeFailure(new UploadError("USER_ALREADY_EXISTS", "邮箱或用户名已存在。", 409));
    }
    return routeFailure(error);
  }
}
