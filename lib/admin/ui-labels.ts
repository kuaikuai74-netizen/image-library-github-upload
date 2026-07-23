export const uploadStatusLabels: Record<string, string> = {
  PENDING: "待处理",
  PROCESSING: "处理中",
  COMPLETED: "已完成",
  PARTIAL: "部分完成",
  FAILED: "失败",
};

export const assetStatusLabels: Record<string, string> = {
  PENDING: "待处理",
  UPLOADING: "上传中",
  PROCESSING: "处理中",
  ACTIVE: "有效",
  FAILED: "失败",
  DELETED: "已删除",
};

export const downloadBatchStatusLabels: Record<string, string> = {
  PREPARED: "已准备",
  DOWNLOADED: "已下载",
  PARTIAL: "部分完成",
  FAILED: "失败",
};

export const downloadBatchTypeLabels: Record<string, string> = {
  ASSETS: "素材 ZIP",
  PRODUCTS: "素材库 ZIP",
};

export const downloadItemStatusLabels: Record<string, string> = {
  READY: "可下载",
  DOWNLOADED: "已下载",
  FAILED: "失败",
};

export const contentStatusLabels: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档",
};

export const userStatusLabels: Record<string, string> = {
  ACTIVE: "启用",
  DISABLED: "禁用",
};

export const checkStatusLabels: Record<string, string> = {
  PASS: "通过",
  WARN: "警告",
  FAIL: "失败",
  UNKNOWN: "未知",
};

export const qualitySeverityLabels: Record<string, string> = {
  ERROR: "错误",
  WARN: "警告",
  INFO: "提示",
};

export const storageProbeStatusLabels: Record<string, string> = {
  HEALTHY: "健康",
  DEGRADED: "降级",
  FAILED: "失败",
  UNKNOWN: "未知",
};

export const fileObjectStatusLabels: Record<string, string> = {
  PROCESSING: "处理中",
  ACTIVE: "有效",
  FAILED: "失败",
};

export const cleanupStatusLabels: Record<string, string> = {
  NONE: "无需清理",
  PENDING: "待清理",
  FAILED: "清理失败",
  COMPLETED: "已清理",
};

export const auditActionLabels: Record<string, string> = {
  ASSET_CREATED: "创建素材",
  ASSET_UPDATED: "更新素材",
  ASSET_MOVED: "移动素材",
  ASSET_DELETED: "删除素材",
  ASSET_RESTORED: "恢复素材",
  ASSET_DOWNLOADED: "下载素材",
  BATCH_DOWNLOAD_REQUESTED: "请求批量下载",
  USER_CREATED: "创建用户",
  USER_UPDATED: "更新用户",
  USER_STATUS_CHANGED: "修改用户状态",
  USER_PASSWORD_RESET: "重置用户密码",
  ANNOUNCEMENT_CREATED: "创建公告",
  ANNOUNCEMENT_UPDATED: "更新公告",
  DOCUMENT_CREATED: "创建文档",
  DOCUMENT_UPDATED: "更新文档",
};

export const auditObjectTypeLabels: Record<string, string> = {
  Asset: "素材",
  UploadRequest: "上传任务",
  DownloadBatch: "下载批次",
  User: "用户",
  Announcement: "公告",
  DocumentPage: "文档",
  FileObject: "文件对象",
};

export function uiLabel(labels: Record<string, string>, value: string | null | undefined) {
  if (!value) return "-";
  return labels[value] ?? value;
}
