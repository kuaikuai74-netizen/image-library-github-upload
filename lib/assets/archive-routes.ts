import { createHash } from "node:crypto";

export const archiveLanguageCountryCodes = {
  "德语": "DE",
  "英语": "UK",
  "法语": "FR",
  "意大利语": "IT",
  "西班牙语": "ES",
} as const;

export type ArchiveCountryCode = (typeof archiveLanguageCountryCodes)[keyof typeof archiveLanguageCountryCodes];

export type ArchiveEntryClassification =
  | { kind: "image"; countryCode: ArchiveCountryCode; other: string | null; filename: string; path: string }
  | { kind: "skip"; path: string; reason: string };

const imageExtensions = new Set(["jpg", "jpeg", "png", "webp"]);

export function classifyArchiveEntry(path: string): ArchiveEntryClassification {
  const segments = path.split("/").filter(Boolean);
  const filename = segments.at(-1) ?? "";
  if (!path || path.startsWith("/") || /^[A-Za-z]:\//.test(path) || path.includes("\\") || segments.some((segment) => segment === "." || segment === "..")) {
    return { kind: "skip", path, reason: "不安全的压缩包路径" };
  }
  if (path.endsWith("/")) return { kind: "skip", path, reason: "目录" };
  if (segments.includes("__MACOSX") || filename === ".DS_Store") return { kind: "skip", path, reason: "系统文件" };

  const extension = filename.split(".").at(-1)?.toLowerCase();
  if (!extension || !imageExtensions.has(extension)) return { kind: "skip", path, reason: "非支持图片" };

  const countrySegmentIndex = segments.findIndex((segment) => Object.hasOwn(archiveLanguageCountryCodes, segment));
  if (countrySegmentIndex < 0) return { kind: "skip", path, reason: "未识别国家目录" };
  const countryCode = archiveLanguageCountryCodes[segments[countrySegmentIndex] as keyof typeof archiveLanguageCountryCodes];
  const otherSegment = segments.slice(countrySegmentIndex + 1, -1).find((segment) => segment.trim());
  return { kind: "image", countryCode, other: otherSegment ?? null, filename, path };
}

export function compareArchivePaths(left: string, right: string) {
  return left.localeCompare(right, "zh-CN", { numeric: true, sensitivity: "base" });
}

export function archiveCountryIdempotencyKey(idempotencyKey: string, countryCode: ArchiveCountryCode) {
  const digest = createHash("sha256").update(`${idempotencyKey}:${countryCode}`).digest("hex");
  const variant = ["8", "9", "a", "b"][Number.parseInt(digest.charAt(16), 16) % 4];
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-${variant}${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}
