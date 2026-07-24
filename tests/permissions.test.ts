import { describe, expect, it } from "vitest";
import { hasAssetPermission, hasSuperAdminPermission } from "../lib/auth/permissions";
import { isActiveUserStatus } from "../lib/auth/roles";

describe("asset permissions", () => {
  it("limits super admin routes to SUPER_ADMIN", () => {
    expect(hasSuperAdminPermission("SUPER_ADMIN")).toBe(true);
    expect(hasSuperAdminPermission("ASSET_ADMIN")).toBe(false);
    expect(hasSuperAdminPermission("UPLOADER")).toBe(false);
    expect(hasSuperAdminPermission("VIEWER")).toBe(false);
  });

  it("grants every asset permission to SUPER_ADMIN", () => {
    const permissions = ["read", "download", "upload", "edit", "delete"] as const;
    permissions.forEach((permission) => {
      expect(hasAssetPermission("SUPER_ADMIN", permission)).toBe(true);
    });
  });

  it("limits ASSET_ADMIN to viewing, downloading, uploading, and deleting", () => {
    expect(hasAssetPermission("ASSET_ADMIN", "read")).toBe(true);
    expect(hasAssetPermission("ASSET_ADMIN", "download")).toBe(true);
    expect(hasAssetPermission("ASSET_ADMIN", "upload")).toBe(true);
    expect(hasAssetPermission("ASSET_ADMIN", "delete")).toBe(true);
    expect(hasAssetPermission("ASSET_ADMIN", "edit")).toBe(false);
  });

  it("limits VIEWER to reading and downloading", () => {
    expect(hasAssetPermission("VIEWER", "read")).toBe(true);
    expect(hasAssetPermission("VIEWER", "download")).toBe(true);
    expect(hasAssetPermission("VIEWER", "upload")).toBe(false);
    expect(hasAssetPermission("VIEWER", "edit", { userId: "viewer", uploadedById: "viewer" })).toBe(false);
    expect(hasAssetPermission("VIEWER", "delete", { userId: "viewer", uploadedById: "viewer" })).toBe(false);
  });

  it("keeps legacy UPLOADER role without asset permissions", () => {
    expect(hasAssetPermission("UPLOADER", "read")).toBe(false);
    expect(hasAssetPermission("UPLOADER", "download")).toBe(false);
    expect(hasAssetPermission("UPLOADER", "upload")).toBe(false);
    expect(hasAssetPermission("UPLOADER", "edit", { userId: "uploader", uploadedById: "uploader" })).toBe(false);
    expect(hasAssetPermission("UPLOADER", "delete", { userId: "uploader", uploadedById: "uploader" })).toBe(false);
  });

  it("treats DISABLED users as inactive", () => {
    expect(isActiveUserStatus("ACTIVE")).toBe(true);
    expect(isActiveUserStatus("DISABLED")).toBe(false);
  });
});
