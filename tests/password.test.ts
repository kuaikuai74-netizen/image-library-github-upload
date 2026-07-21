import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../lib/auth/password";

describe("password hashing", () => {
  it("stores a one-way bcrypt hash and rejects an incorrect password", async () => {
    const passwordHash = await hashPassword("local-test-password");
    expect(passwordHash).not.toBe("local-test-password");
    await expect(verifyPassword("local-test-password", passwordHash)).resolves.toBe(true);
    await expect(verifyPassword("incorrect-password", passwordHash)).resolves.toBe(false);
  });
});
