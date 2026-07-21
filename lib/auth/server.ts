import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { hasAssetPermission, type AssetPermission } from "@/lib/auth/permissions";
import type { LibraryUser } from "@/lib/auth/roles";
import { isActiveUserStatus } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";

export class AuthorizationError extends Error {
  constructor(public readonly status: 401 | 403) {
    super(status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN");
  }
}

export async function getCurrentUser(): Promise<LibraryUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, role: true, status: true },
  });

  if (!user || !isActiveUserStatus(user.status)) return null;
  return user;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError(401);
  return user;
}

export async function requireAssetPermission(permission: AssetPermission, uploadedById?: string) {
  const user = await requireCurrentUser();
  if (!hasAssetPermission(user.role, permission, { userId: user.id, uploadedById })) {
    throw new AuthorizationError(403);
  }
  return user;
}
