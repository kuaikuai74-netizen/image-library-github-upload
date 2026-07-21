import type { UserRole, UserStatus } from "@prisma/client";
import type { NextAuthOptions } from "next-auth";
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authenticateCredentials } from "@/lib/auth/authenticate";

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "账号密码",
      credentials: {
        identifier: { label: "用户名或邮箱", type: "text" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        return authenticateCredentials(credentials);
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role as UserRole;
        token.status = user.status as UserStatus;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.userId === "string" && typeof token.role === "string") {
        session.user.id = token.userId;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
};

export const authHandler = NextAuth(authOptions);
