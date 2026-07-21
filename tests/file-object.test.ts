import { describe, expect, it } from "vitest";
import { isReusableFileObject } from "../lib/assets/file-object";

describe("duplicate file reuse", () => {
  it("reuses only active file objects that have not completed physical cleanup", () => {
    expect(isReusableFileObject({ status: "ACTIVE", cleanupStatus: "NONE" })).toBe(true);
    expect(isReusableFileObject({ status: "ACTIVE", cleanupStatus: "PENDING" })).toBe(true);
    expect(isReusableFileObject({ status: "ACTIVE", cleanupStatus: "COMPLETED" })).toBe(false);
    expect(isReusableFileObject({ status: "FAILED", cleanupStatus: "NONE" })).toBe(false);
  });
});
