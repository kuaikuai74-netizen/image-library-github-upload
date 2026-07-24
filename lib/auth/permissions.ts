import type { UserRole } from "@/lib/auth/roles";

export type AssetPermission = "read" | "download" | "upload" | "edit" | "delete";

type AssetPermissionContext = {
  userId?: string;
  uploadedById?: string;
};

export function hasSuperAdminPermission(role: UserRole) {
  return role === "SUPER_ADMIN";
}

export function hasAssetPermission(
  role: UserRole,
  permission: AssetPermission,
  context: AssetPermissionContext = {},
) {
  void context;
  if (role === "SUPER_ADMIN") return true;
  if (role === "ASSET_ADMIN") return permission === "read" || permission === "download" || permission === "upload" || permission === "delete";
  if (role === "VIEWER") return permission === "read" || permission === "download";
  return false;
}
