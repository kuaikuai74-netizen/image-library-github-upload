export const userRoles = ["SUPER_ADMIN", "ASSET_ADMIN", "UPLOADER", "VIEWER"] as const;
export type UserRole = (typeof userRoles)[number];

export const userStatuses = ["ACTIVE", "DISABLED"] as const;
export type UserStatus = (typeof userStatuses)[number];

export function isActiveUserStatus(status: UserStatus) {
  return status === "ACTIVE";
}

export type LibraryUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export const roleLabels: Record<UserRole, string> = {
  SUPER_ADMIN: "超级管理员",
  ASSET_ADMIN: "素材管理员",
  UPLOADER: "上传人员",
  VIEWER: "查看人员",
};
