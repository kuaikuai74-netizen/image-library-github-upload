import { describe, expect, it } from "vitest";
import { hasAssetPermission } from "../lib/auth/permissions";
import { isActiveUserStatus } from "../lib/auth/roles";

describe("asset permissions", () => {
  it("grants every asset permission to SUPER_ADMIN and ASSET_ADMIN", () => {
    const permissions = ["read", "download", "upload", "edit", "delete"] as const;
    permissions.forEach((permission) => {
      expect(hasAssetPermission("SUPER_ADMIN", permission)).toBe(true);
      expect(hasAssetPermission("ASSET_ADMIN", permission)).toBe(true);
    });
  });

  it("limits VIEWER to reading and downloading", () => {
    expect(hasAssetPermission("VIEWER", "read")).toBe(true);
    expect(hasAssetPermission("VIEWER", "download")).toBe(true);
    expect(hasAssetPermission("VIEWER", "upload")).toBe(false);
    expect(hasAssetPermission("VIEWER", "edit", { userId: "viewer", uploadedById: "viewer" })).toBe(false);
    expect(hasAssetPermission("VIEWER", "delete", { userId: "viewer", uploadedById: "viewer" })).toBe(false);
  });

  it("allows UPLOADER to edit or delete only assets they uploaded", () => {
    expect(hasAssetPermission("UPLOADER", "read")).toBe(true);
    expect(hasAssetPermission("UPLOADER", "upload")).toBe(true);
    expect(hasAssetPermission("UPLOADER", "edit", { userId: "uploader", uploadedById: "uploader" })).toBe(true);
    expect(hasAssetPermission("UPLOADER", "delete", { userId: "uploader", uploadedById: "uploader" })).toBe(true);
    expect(hasAssetPermission("UPLOADER", "edit", { userId: "uploader", uploadedById: "another-user" })).toBe(false);
    expect(hasAssetPermission("UPLOADER", "delete", { userId: "uploader", uploadedById: "another-user" })).toBe(false);
  });

  it("treats DISABLED users as inactive", () => {
    expect(isActiveUserStatus("ACTIVE")).toBe(true);
    expect(isActiveUserStatus("DISABLED")).toBe(false);
  });
});
