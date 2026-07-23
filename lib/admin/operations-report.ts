import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const defaultDays = 14;
const maxDays = 90;

type RawOperationsReportParams = Record<string, string | string[] | undefined>;

export type AdminOperationsReportFilters = {
  from: Date;
  to: Date;
};

type TrendRow = {
  date: string;
  assetsCreated: unknown;
  assetFailures: unknown;
  uploadBatches: unknown;
  uploadFailures: unknown;
  downloadBatches: unknown;
  downloadedAssets: unknown;
  downloadFailures: unknown;
};

type RankingRow = {
  name: string;
  count: unknown;
  bytes?: unknown;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function parseDate(value: string | undefined, boundary: "start" | "end") {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return boundary === "start" ? startOfDay(date) : endOfDay(date);
}

function clampRange(from: Date, to: Date) {
  if (from > to) return defaultRange();
  const maxFrom = new Date(to);
  maxFrom.setDate(maxFrom.getDate() - (maxDays - 1));
  return { from: from < maxFrom ? startOfDay(maxFrom) : from, to };
}

function defaultRange() {
  const to = endOfDay(new Date());
  const from = startOfDay(new Date());
  from.setDate(from.getDate() - (defaultDays - 1));
  return { from, to };
}

function numberValue(value: unknown) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

function dateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function rate(numerator: number, denominator: number) {
  return denominator ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function parseAdminOperationsReportFilters(params: RawOperationsReportParams): AdminOperationsReportFilters {
  const fallback = defaultRange();
  return clampRange(
    parseDate(firstValue(params.reportFrom), "start") ?? fallback.from,
    parseDate(firstValue(params.reportTo), "end") ?? fallback.to,
  );
}

export function serializeOperationsReportFilters(filters: AdminOperationsReportFilters) {
  return {
    from: dateInput(filters.from),
    to: dateInput(filters.to),
  };
}

async function getTrendRows(filters: AdminOperationsReportFilters) {
  return prisma.$queryRaw<TrendRow[]>(Prisma.sql`
    SELECT
      to_char(days.day, 'YYYY-MM-DD') AS "date",
      COALESCE(asset_rows."assetsCreated", 0) AS "assetsCreated",
      COALESCE(asset_rows."assetFailures", 0) AS "assetFailures",
      COALESCE(upload_rows."uploadBatches", 0) AS "uploadBatches",
      COALESCE(upload_rows."uploadFailures", 0) AS "uploadFailures",
      COALESCE(download_rows."downloadBatches", 0) AS "downloadBatches",
      COALESCE(download_rows."downloadedAssets", 0) AS "downloadedAssets",
      COALESCE(download_rows."downloadFailures", 0) AS "downloadFailures"
    FROM generate_series(${filters.from}::timestamp, ${filters.to}::timestamp, interval '1 day') AS days(day)
    LEFT JOIN (
      SELECT
        date_trunc('day', "createdAt") AS day,
        COUNT(*) FILTER (WHERE status = 'ACTIVE') AS "assetsCreated",
        COUNT(*) FILTER (WHERE status = 'FAILED') AS "assetFailures"
      FROM "Asset"
      WHERE "createdAt" BETWEEN ${filters.from} AND ${filters.to}
      GROUP BY 1
    ) asset_rows ON asset_rows.day = days.day
    LEFT JOIN (
      SELECT
        date_trunc('day', "createdAt") AS day,
        COUNT(*) AS "uploadBatches",
        COUNT(*) FILTER (WHERE status IN ('PARTIAL', 'FAILED')) AS "uploadFailures"
      FROM "UploadRequest"
      WHERE "createdAt" BETWEEN ${filters.from} AND ${filters.to}
      GROUP BY 1
    ) upload_rows ON upload_rows.day = days.day
    LEFT JOIN (
      SELECT
        date_trunc('day', "preparedAt") AS day,
        COUNT(*) AS "downloadBatches",
        COALESCE(SUM("readyCount"), 0) AS "downloadedAssets",
        COALESCE(SUM("failedCount"), 0) AS "downloadFailures"
      FROM "DownloadBatch"
      WHERE "preparedAt" BETWEEN ${filters.from} AND ${filters.to}
      GROUP BY 1
    ) download_rows ON download_rows.day = days.day
    ORDER BY days.day ASC
  `);
}

async function getCategoryRows(filters: AdminOperationsReportFilters) {
  return prisma.$queryRaw<RankingRow[]>(Prisma.sql`
    SELECT c.name AS name, COUNT(a.id) AS count, COALESCE(SUM(f."fileSizeBytes"), 0) AS bytes
    FROM "Asset" a
    JOIN "AssetGroup" ag ON ag.id = a."assetGroupId"
    JOIN "Category" c ON c.id = ag."categoryId"
    JOIN "FileObject" f ON f.id = a."fileObjectId"
    WHERE a.status = 'ACTIVE' AND a."createdAt" BETWEEN ${filters.from} AND ${filters.to}
    GROUP BY c.name
    ORDER BY count DESC, c.name ASC
    LIMIT 8
  `);
}

async function getChannelRows(filters: AdminOperationsReportFilters) {
  return prisma.$queryRaw<RankingRow[]>(Prisma.sql`
    SELECT ch.name AS name, COUNT(a.id) AS count, COALESCE(SUM(f."fileSizeBytes"), 0) AS bytes
    FROM "Asset" a
    JOIN "AssetGroup" ag ON ag.id = a."assetGroupId"
    JOIN "Channel" ch ON ch.id = ag."channelId"
    JOIN "FileObject" f ON f.id = a."fileObjectId"
    WHERE a.status = 'ACTIVE' AND a."createdAt" BETWEEN ${filters.from} AND ${filters.to}
    GROUP BY ch.name
    ORDER BY count DESC, ch.name ASC
    LIMIT 8
  `);
}

async function getDownloadUserRows(filters: AdminOperationsReportFilters) {
  return prisma.$queryRaw<RankingRow[]>(Prisma.sql`
    SELECT COALESCE(u.name, '未知用户') AS name, COUNT(b.id) AS count, COALESCE(SUM(b."readyCount"), 0) AS bytes
    FROM "DownloadBatch" b
    LEFT JOIN "User" u ON u.id = b."actorId"
    WHERE b."preparedAt" BETWEEN ${filters.from} AND ${filters.to}
    GROUP BY u.name
    ORDER BY count DESC, name ASC
    LIMIT 8
  `);
}

function mapRanking(row: RankingRow) {
  return {
    name: row.name,
    count: numberValue(row.count),
    bytes: numberValue(row.bytes),
  };
}

export async function getAdminOperationsReport(filters: AdminOperationsReportFilters) {
  const [trendRows, categoryRows, channelRows, downloadUserRows] = await Promise.all([
    getTrendRows(filters),
    getCategoryRows(filters),
    getChannelRows(filters),
    getDownloadUserRows(filters),
  ]);

  const trends = trendRows.map((row) => ({
    date: row.date,
    assetsCreated: numberValue(row.assetsCreated),
    assetFailures: numberValue(row.assetFailures),
    uploadBatches: numberValue(row.uploadBatches),
    uploadFailures: numberValue(row.uploadFailures),
    downloadBatches: numberValue(row.downloadBatches),
    downloadedAssets: numberValue(row.downloadedAssets),
    downloadFailures: numberValue(row.downloadFailures),
  }));
  const totals = trends.reduce(
    (current, row) => ({
      assetsCreated: current.assetsCreated + row.assetsCreated,
      assetFailures: current.assetFailures + row.assetFailures,
      uploadBatches: current.uploadBatches + row.uploadBatches,
      uploadFailures: current.uploadFailures + row.uploadFailures,
      downloadBatches: current.downloadBatches + row.downloadBatches,
      downloadedAssets: current.downloadedAssets + row.downloadedAssets,
      downloadFailures: current.downloadFailures + row.downloadFailures,
    }),
    { assetsCreated: 0, assetFailures: 0, uploadBatches: 0, uploadFailures: 0, downloadBatches: 0, downloadedAssets: 0, downloadFailures: 0 },
  );

  return {
    filters: serializeOperationsReportFilters(filters),
    totals: {
      ...totals,
      uploadFailureRate: rate(totals.uploadFailures, totals.uploadBatches),
      assetFailureRate: rate(totals.assetFailures, totals.assetsCreated + totals.assetFailures),
      downloadFailureRate: rate(totals.downloadFailures, totals.downloadedAssets + totals.downloadFailures),
    },
    trends,
    rankings: {
      categories: categoryRows.map(mapRanking),
      channels: channelRows.map(mapRanking),
      downloadUsers: downloadUserRows.map(mapRanking),
    },
  };
}

export async function exportAdminOperationsReportCsv(filters: AdminOperationsReportFilters) {
  const report = await getAdminOperationsReport(filters);
  const header = ["日期", "新增素材", "失败文件", "上传批次", "异常上传批次", "下载批次", "下载素材数", "下载失败项"];
  const rows = report.trends.map((row) => [row.date, row.assetsCreated, row.assetFailures, row.uploadBatches, row.uploadFailures, row.downloadBatches, row.downloadedAssets, row.downloadFailures]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export type AdminOperationsReport = Awaited<ReturnType<typeof getAdminOperationsReport>>;
