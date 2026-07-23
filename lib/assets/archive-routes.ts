import { createHash } from "node:crypto";

export const archiveLanguageCountryCodes = {
  "德语": "DE",
  "德文": "DE",
  "德国": "DE",
  "英语": "UK",
  "英文": "UK",
  "英国": "UK",
  "法语": "FR",
  "法文": "FR",
  "法国": "FR",
  "意大利语": "IT",
  "意大利": "IT",
  "西班牙语": "ES",
  "西班牙": "ES",
} as const;

export type ArchiveCountryCode = (typeof archiveLanguageCountryCodes)[keyof typeof archiveLanguageCountryCodes];

export type ArchiveEntryClassification =
  | { kind: "image"; countryCode: ArchiveCountryCode; other: string | null; filename: string; path: string }
  | { kind: "skip"; path: string; reason: string };

const imageExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
const archivePathDecoders = ["utf-8", "gb18030"] as const;

function normalizeArchivePath(path: string) {
  return path.replace(/\\/g, "/");
}

function normalizeCountrySegment(segment: string) {
  return segment.trim().replace(/[：:].*$/, "").trim();
}

export function archivePathCandidates(decodedPath: string, rawPath?: Uint8Array) {
  const candidates = new Set([decodedPath]);
  if (rawPath) {
    for (const encoding of archivePathDecoders) {
      candidates.add(new TextDecoder(encoding).decode(rawPath));
    }
  }
  return [...candidates];
}

export function classifyArchiveEntry(path: string): ArchiveEntryClassification {
  const normalizedPath = normalizeArchivePath(path);
  const segments = normalizedPath.split("/").map((segment) => segment.trim()).filter(Boolean);
  const filename = segments.at(-1) ?? "";
  if (!path || normalizedPath.startsWith("/") || /^[A-Za-z]:\//.test(normalizedPath) || segments.some((segment) => segment === "." || segment === "..")) {
    return { kind: "skip", path, reason: "不安全的压缩包路径" };
  }
  if (normalizedPath.endsWith("/")) return { kind: "skip", path, reason: "目录" };
  if (segments.includes("__MACOSX") || filename === ".DS_Store") return { kind: "skip", path, reason: "系统文件" };

  const extension = filename.split(".").at(-1)?.toLowerCase();
  if (!extension || !imageExtensions.has(extension)) return { kind: "skip", path, reason: "非支持图片" };

  const countrySegmentIndex = segments.findIndex((segment) => Object.hasOwn(archiveLanguageCountryCodes, normalizeCountrySegment(segment)));
  if (countrySegmentIndex < 0) return { kind: "skip", path, reason: "未识别国家目录" };
  const countryKey = normalizeCountrySegment(segments[countrySegmentIndex]) as keyof typeof archiveLanguageCountryCodes;
  const countryCode = archiveLanguageCountryCodes[countryKey];
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
