import { compare, hash } from "bcryptjs";

const passwordHashRounds = 12;

export function hashPassword(password: string) {
  return hash(password, passwordHashRounds);
}

export function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}
