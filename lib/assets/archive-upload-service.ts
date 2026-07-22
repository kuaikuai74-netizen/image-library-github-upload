import type { Readable } from "node:stream";
import * as yauzl from "yauzl";
import { archiveCountryIdempotencyKey, classifyArchiveEntry, compareArchivePaths, type ArchiveCountryCode } from "@/lib/assets/archive-routes";
import type { ArchiveUploadRequest } from "@/lib/assets/archive-upload-schema";
import { ensureAssetGroup } from "@/lib/assets/asset-group-service";
import { maximumUploadBytes, UploadError, uploadFiles, type UploadFileInput } from "@/lib/assets/upload-service";

type ArchiveImageEntry = { countryCode: ArchiveCountryCode; entry: yauzl.Entry; filename: string; path: string };
type ArchiveSkippedEntry = { path: string; reason: string };

export type ArchiveUploadCountryResult = {
  countryCode: ArchiveCountryCode;
  assetGroupId: string | null;
  total: number;
  uploaded: number;
  failed: number;
  status: "COMPLETED" | "PARTIAL" | "FAILED";
  message: string | null;
  failures: Array<{ filename: string; message: string }>;
};

export type ArchiveUploadResult = {
  countries: ArchiveUploadCountryResult[];
  skippedEntries: ArchiveSkippedEntry[];
};

const maximumArchiveBytes = configuredLimit("MAX_ZIP_UPLOAD_BYTES", 262_144_000);
const maximumArchiveEntries = configuredLimit("MAX_ZIP_ENTRIES", 500);
const maximumArchiveUncompressedBytes = configuredLimit("MAX_ZIP_UNCOMPRESSED_BYTES", 314_572_800);

export async function uploadZipArchive(context: ArchiveUploadRequest, uploaderId: string, archive: File): Promise<ArchiveUploadResult> {
  validateArchive(archive);
  const archiveBuffer = Buffer.from(await archive.arrayBuffer());
  const zipFile = await openZipArchive(archiveBuffer);

  try {
    const { images, skippedEntries } = await listArchiveEntries(zipFile);
    if (!images.length) throw new UploadError("ARCHIVE_EMPTY", "压缩包内未发现可识别国家的 JPEG、PNG 或 WEBP 图片。");

    const groupedEntries = groupEntriesByCountry(images);
    const countries: ArchiveUploadCountryResult[] = [];

    for (const [countryCode, entries] of groupedEntries) {
      const { inputs, failures } = await createArchiveUploadInputs(zipFile, entries, context.assetType);
      if (!inputs.length) {
        countries.push({
          countryCode,
          assetGroupId: null,
          total: entries.length,
          uploaded: 0,
          failed: failures.length,
          status: "FAILED",
          message: "该国家没有可处理的图片。",
          failures,
        });
        continue;
      }

      const assetGroup = await ensureAssetGroup({
        channelId: context.channelId,
        categoryId: context.categoryId,
        spu: context.spu,
        countryCode,
        assetType: context.assetType,
      });
      const assetGroupId = assetGroup.id;
      const request = await uploadFiles(assetGroupId, uploaderId, archiveCountryIdempotencyKey(context.idempotencyKey, countryCode), inputs, { sequential: true });
      const uploadFailures = request.files
        .filter((file) => file.status !== "ACTIVE")
        .map((file) => ({ filename: file.originalFilename, message: file.errorMessage ?? "图片处理失败。" }));
      const uploaded = request.files.filter((file) => file.status === "ACTIVE").length;
      const allFailures = [...failures, ...uploadFailures];
      countries.push({
        countryCode,
        assetGroupId,
        total: entries.length,
        uploaded,
        failed: allFailures.length,
        status: uploaded === entries.length ? "COMPLETED" : uploaded ? "PARTIAL" : "FAILED",
        message: allFailures.length ? "部分图片未能上传。" : null,
        failures: allFailures,
      });
    }

    return { countries, skippedEntries };
  } finally {
    closeZipArchive(zipFile);
  }
}

function configuredLimit(name: string, fallback: number) {
  const configured = Number(process.env[name]);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : fallback;
}

function validateArchive(archive: File) {
  if (!archive.name.toLowerCase().endsWith(".zip")) throw new UploadError("INVALID_ARCHIVE", "仅支持 ZIP 格式压缩包。");
  if (!archive.size) throw new UploadError("EMPTY_ARCHIVE", "不允许上传空压缩包。");
  if (archive.size > maximumArchiveBytes) throw new UploadError("ARCHIVE_TOO_LARGE", `压缩包不得超过 ${Math.floor(maximumArchiveBytes / 1_000_000)} MB。`);
}

function openZipArchive(buffer: Buffer) {
  return new Promise<yauzl.ZipFile>((resolve, reject) => {
    yauzl.fromBuffer(buffer, { autoClose: false, lazyEntries: true, strictFileNames: true, validateEntrySizes: true }, (error, zipFile) => {
      if (error) {
        reject(new UploadError("INVALID_ARCHIVE", "无法读取 ZIP 压缩包。"));
        return;
      }
      resolve(zipFile);
    });
  });
}

function listArchiveEntries(zipFile: yauzl.ZipFile) {
  if (zipFile.entryCount > maximumArchiveEntries) throw new UploadError("ARCHIVE_TOO_MANY_ENTRIES", `压缩包最多包含 ${maximumArchiveEntries} 个条目。`);

  return new Promise<{ images: ArchiveImageEntry[]; skippedEntries: ArchiveSkippedEntry[] }>((resolve, reject) => {
    const images: ArchiveImageEntry[] = [];
    const skippedEntries: ArchiveSkippedEntry[] = [];
    let totalUncompressedBytes = 0;
    let settled = false;

    const cleanup = () => {
      zipFile.removeListener("entry", onEntry);
      zipFile.removeListener("end", onEnd);
      zipFile.removeListener("error", onError);
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      closeZipArchive(zipFile);
      reject(error);
    };
    const onError = () => fail(new UploadError("INVALID_ARCHIVE", "无法读取 ZIP 压缩包。"));
    const onEnd = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ images: images.sort((left, right) => compareArchivePaths(left.path, right.path)), skippedEntries });
    };
    const onEntry = (entry: yauzl.Entry) => {
      if (settled) return;
      totalUncompressedBytes += entry.uncompressedSize;
      if (totalUncompressedBytes > maximumArchiveUncompressedBytes) {
        fail(new UploadError("ARCHIVE_UNCOMPRESSED_TOO_LARGE", `压缩包解压后不得超过 ${Math.floor(maximumArchiveUncompressedBytes / 1_000_000)} MB。`));
        return;
      }

      const classification = classifyArchiveEntry(entry.fileName);
      if (classification.kind === "image") {
        images.push({ countryCode: classification.countryCode, entry, filename: classification.filename, path: classification.path });
      } else if (classification.reason !== "目录" && classification.reason !== "系统文件") {
        skippedEntries.push({ path: classification.path, reason: classification.reason });
      }
      zipFile.readEntry();
    };

    zipFile.on("entry", onEntry);
    zipFile.once("end", onEnd);
    zipFile.once("error", onError);
    zipFile.readEntry();
  });
}

function groupEntriesByCountry(entries: ArchiveImageEntry[]) {
  const grouped = new Map<ArchiveCountryCode, ArchiveImageEntry[]>();
  for (const entry of entries) grouped.set(entry.countryCode, [...(grouped.get(entry.countryCode) ?? []), entry]);
  return grouped;
}

async function createArchiveUploadInputs(zipFile: yauzl.ZipFile, entries: ArchiveImageEntry[], assetType: string) {
  const inputs: UploadFileInput[] = [];
  const failures: Array<{ filename: string; message: string }> = [];
  for (const [index, entry] of entries.entries()) {
    if (entry.entry.uncompressedSize > maximumUploadBytes) {
      failures.push({ filename: entry.filename, message: `单个文件不得超过 ${Math.floor(maximumUploadBytes / 1_000_000)} MB。` });
      continue;
    }
    try {
      const body = await readZipEntry(zipFile, entry.entry, maximumUploadBytes);
      const fileBody = new Uint8Array(body.byteLength);
      fileBody.set(body);
      inputs.push({ file: new File([fileBody], entry.filename), metadata: { assetType, sortOrder: index + 1 } });
    } catch {
      failures.push({ filename: entry.filename, message: "无法读取压缩包中的图片。" });
    }
  }
  return { inputs, failures };
}

function readZipEntry(zipFile: yauzl.ZipFile, entry: yauzl.Entry, maximumBytes: number) {
  return new Promise<Buffer>((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error) {
        reject(error);
        return;
      }
      readStreamToBuffer(stream, maximumBytes).then(resolve, reject);
    });
  });
}

function readStreamToBuffer(stream: Readable, maximumBytes: number) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    stream.on("data", (chunk: Uint8Array | string) => {
      const buffer = Buffer.from(chunk);
      totalBytes += buffer.byteLength;
      if (totalBytes > maximumBytes) {
        stream.destroy(new UploadError("FILE_TOO_LARGE", `单个文件不得超过 ${Math.floor(maximumBytes / 1_000_000)} MB。`));
        return;
      }
      chunks.push(buffer);
    });
    stream.once("error", fail);
    stream.once("end", () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks));
    });
  });
}

function closeZipArchive(zipFile: yauzl.ZipFile) {
  try {
    zipFile.close();
  } catch {
    // The archive may already have been closed while handling a malformed ZIP.
  }
}
