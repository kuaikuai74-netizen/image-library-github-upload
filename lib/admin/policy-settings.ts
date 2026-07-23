import { archiveLanguageCountryCodes } from "@/lib/assets/archive-routes";
import { maximumUploadBytes } from "@/lib/assets/upload-service";
import { roleLabels, userRoles, type UserRole } from "@/lib/auth/roles";
import { assetTypeOptions, countryOptions } from "@/lib/library/countries";

const maximumArchiveBytes = configuredLimit("MAX_ZIP_UPLOAD_BYTES", 262_144_000);
const maximumArchiveEntries = configuredLimit("MAX_ZIP_ENTRIES", 500);
const maximumArchiveUncompressedBytes = configuredLimit("MAX_ZIP_UNCOMPRESSED_BYTES", 314_572_800);

const rolePermissions: Record<UserRole, string[]> = {
  SUPER_ADMIN: ["后台管理", "查看", "下载", "上传", "编辑", "删除", "用户/公告/文档管理"],
  ASSET_ADMIN: ["查看", "下载", "上传", "编辑", "删除"],
  UPLOADER: ["查看", "上传", "编辑/删除本人上传素材"],
  VIEWER: ["查看", "下载"],
};

function configuredLimit(name: string, fallback: number) {
  const configured = Number(process.env[name]);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : fallback;
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function envSource(name: string) {
  return process.env[name] ? `环境变量 ${name}` : `默认值，可用 ${name} 覆盖`;
}

export function getAdminPolicySettings() {
  return {
    uploadLimits: [
      { label: "单图上传大小", value: formatBytes(maximumUploadBytes), source: envSource("MAX_UPLOAD_BYTES") },
      { label: "单次普通上传文件数", value: "1-20 个", source: "代码固定：uploadRequestSchema.metadata.max(20)" },
      { label: "素材排序范围", value: "1-10,000", source: "代码固定：uploadMetadataSchema.sortOrder" },
      { label: "其他/颜色字段长度", value: "1-64 字符", source: "代码固定：uploadMetadataSchema.color" },
    ],
    archiveLimits: [
      { label: "ZIP 文件大小", value: formatBytes(maximumArchiveBytes), source: envSource("MAX_ZIP_UPLOAD_BYTES") },
      { label: "ZIP 条目数", value: `${maximumArchiveEntries} 个`, source: envSource("MAX_ZIP_ENTRIES") },
      { label: "ZIP 解压后总大小", value: formatBytes(maximumArchiveUncompressedBytes), source: envSource("MAX_ZIP_UNCOMPRESSED_BYTES") },
      { label: "ZIP 支持图片", value: "jpg、jpeg、png、webp", source: "代码固定：archive-routes" },
      { label: "路径解码", value: "UTF-8 / GB18030", source: "代码固定：archive-routes" },
    ],
    taxonomy: {
      countries: countryOptions.map((country) => `${country.name}(${country.code})`),
      assetTypes: [...assetTypeOptions],
      archiveLanguageMappings: Object.entries(archiveLanguageCountryCodes).map(([label, code]) => `${label} -> ${code}`),
    },
    permissions: userRoles.map((role) => ({ role, label: roleLabels[role], permissions: rolePermissions[role] })),
    contentRules: [
      { label: "公告标题", value: "1-160 字符", source: "代码固定：content-schema" },
      { label: "公告正文", value: "1-10,000 字符", source: "代码固定：content-schema" },
      { label: "公告状态", value: "草稿 / 已发布 / 已归档", source: "数据库枚举 ContentStatus" },
      { label: "公告类型", value: "通知 / 维护 / 规范 / 警示", source: "数据库枚举 AnnouncementType" },
      { label: "文档 slug", value: "2-120 字符，小写字母数字与连字符", source: "代码固定：content-schema" },
      { label: "文档正文", value: "1-20,000 字符", source: "代码固定：content-schema" },
      { label: "可见角色", value: "空数组表示全员可见；指定后仅对应角色可见", source: "公告与文档 visibilityRoles" },
    ],
    downloadRules: [
      { label: "单图下载", value: "登录且拥有 download 权限", source: "requireAssetPermission('download')" },
      { label: "多图 ZIP", value: "先创建下载批次，再通过受保护 URL 下载", source: "DownloadBatch / DownloadBatchItem" },
      { label: "素材库 ZIP 目录", value: "国家 / 图片类型 / 其他 / 文件名", source: "products batch-download" },
      { label: "下载追踪", value: "记录用户、时间、IP、User-Agent、成功/失败明细", source: "DownloadBatch" },
    ],
    storageRules: [
      { label: "当前存储驱动", value: process.env.STORAGE_DRIVER ?? "local", source: envSource("STORAGE_DRIVER") },
      { label: "本地存储根", value: process.env.LOCAL_STORAGE_ROOT ?? "./data/storage", source: envSource("LOCAL_STORAGE_ROOT") },
      { label: "派生图", value: "缩略图 480px WebP；预览图 1600px WebP", source: "upload-service Sharp 处理" },
      { label: "删除策略", value: "素材软删除；物理文件只进入待清理队列", source: "FileObject cleanupStatus" },
    ],
  };
}

export type AdminPolicySettings = ReturnType<typeof getAdminPolicySettings>;
