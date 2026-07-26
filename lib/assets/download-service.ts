import archiver from "archiver";
import type { Archiver } from "archiver";
import { PassThrough, Readable } from "node:stream";
import { getStorageService } from "@/lib/storage";

export type DownloadableAsset = { id: string; filename: string; archivePath?: string[]; fileObject: { originalStorageKey: string } };
export type FailedDownloadItem = { assetId: string | null; filename: string | null; status: "FAILED"; errorCode: string | null };

function safeDownloadFilename(filename: string) {
  return filename.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").slice(0, 180) || "asset";
}

function asciiDownloadFilename(filename: string) {
  return safeDownloadFilename(filename).replace(/[^\x20-\x7E]/g, "_") || "asset";
}

function safeArchiveName(asset: DownloadableAsset) {
  if (!asset.archivePath?.length) return safeDownloadFilename(asset.filename);
  const segments = [...asset.archivePath, asset.filename].map(safeDownloadFilename).filter(Boolean);
  return segments.join("/") || safeDownloadFilename(asset.filename);
}

function withAssetId(asset: DownloadableAsset, archiveName: string) {
  const segments = archiveName.split("/");
  const basename = segments.pop() ?? safeDownloadFilename(asset.filename);
  return [...segments, `${asset.id}-${basename}`].join("/");
}

export function downloadHeaders(filename: string, contentType: string) {
  const safeFilename = safeDownloadFilename(filename);
  const asciiFilename = asciiDownloadFilename(filename);
  return {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`,
    "Cache-Control": "private, no-store",
  };
}

export function createZipStream(assets: DownloadableAsset[], failedItems: FailedDownloadItem[] = []) {
  const output = new PassThrough();
  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.on("error", (error: Error) => output.destroy(error));
  archive.pipe(output);
  void appendArchive(archive, assets, failedItems).catch((error: unknown) => output.destroy(error instanceof Error ? error : new Error("批量下载失败。")));
  return output;
}

async function appendArchive(archive: Archiver, assets: DownloadableAsset[], failedItems: FailedDownloadItem[]) {
  const storage = getStorageService();
  const manifest: Array<{ assetId: string | null; filename: string | null; status: "READY" | "FAILED"; errorCode?: string | null }> = failedItems.map((item) => ({ assetId: item.assetId, filename: item.filename, status: item.status, errorCode: item.errorCode }));
  const usedFilenames = new Set<string>();
  for (const asset of assets) {
    const object = await storage.get(asset.fileObject.originalStorageKey);
    if (!object) {
      manifest.push({ assetId: asset.id, filename: asset.filename, status: "FAILED" });
      continue;
    }
    let filename = safeArchiveName(asset);
    if (usedFilenames.has(filename)) filename = withAssetId(asset, filename);
    usedFilenames.add(filename);
    archive.append(object.body, { name: filename });
    manifest.push({ assetId: asset.id, filename, status: "READY" });
  }
  archive.append(JSON.stringify({ generatedAt: new Date().toISOString(), items: manifest }, null, 2), { name: "manifest.json" });
  await archive.finalize();
}

export function nodeStreamResponse(stream: Readable, headers: Record<string, string>) {
  return new Response(Readable.toWeb(stream) as ReadableStream, { headers });
}
