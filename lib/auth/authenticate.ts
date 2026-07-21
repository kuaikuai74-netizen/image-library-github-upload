import { credentialsSchema, normalizeIdentifier } from "@/lib/auth/credentials";
import { verifyPassword } from "@/lib/auth/password";
import { isActiveUserStatus } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";

export async function authenticateCredentials(credentials: unknown) {
  const parsed = credentialsSchema.safeParse(credentials);
  if (!parsed.success) return null;

  const identifier = normalizeIdentifier(parsed.data.identifier);
  const user = await prisma.user.findFirst({ where: { OR: [{ email: identifier }, { username: identifier }] } });
  if (!user || !isActiveUserStatus(user.status)) return null;
  const passwordMatches = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!passwordMatches) return null;

  return { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status };
}
