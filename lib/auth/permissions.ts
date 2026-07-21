import type { UserRole } from "@/lib/auth/roles";

export type AssetPermission = "read" | "download" | "upload" | "edit" | "delete";

type AssetPermissionContext = {
  userId?: string;
  uploadedById?: string;
};

export function hasAssetPermission(
  role: UserRole,
  permission: AssetPermission,
  context: AssetPermissionContext = {},
) {
  if (role === "SUPER_ADMIN" || role === "ASSET_ADMIN") return true;
  if (role === "VIEWER") return permission === "read" || permission === "download";
  if (permission === "read" || permission === "upload") return true;
  return (permission === "edit" || permission === "delete") && context.userId === context.uploadedById;
}
