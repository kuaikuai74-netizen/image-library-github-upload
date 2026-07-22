import archiver from "archiver";
import type { Archiver } from "archiver";
import { PassThrough, Readable } from "node:stream";
import { getStorageService } from "@/lib/storage";

type DownloadableAsset = { id: string; filename: string; fileObject: { originalStorageKey: string } };

function safeDownloadFilename(filename: string) {
  return filename.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").slice(0, 180) || "asset";
}

export function downloadHeaders(filename: string, contentType: string) {
  const safeFilename = safeDownloadFilename(filename);
  return {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`,
    "Cache-Control": "private, no-store",
  };
}

export function createZipStream(assets: DownloadableAsset[]) {
  const output = new PassThrough();
  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.on("error", (error: Error) => output.destroy(error));
  archive.pipe(output);
  void appendArchive(archive, assets).catch((error: unknown) => output.destroy(error instanceof Error ? error : new Error("批量下载失败。")));
  return output;
}

async function appendArchive(archive: Archiver, assets: DownloadableAsset[]) {
  const storage = getStorageService();
  const manifest: Array<{ assetId: string; filename: string; status: "READY" | "FAILED" }> = [];
  const usedFilenames = new Set<string>();
  for (const asset of assets) {
    const object = await storage.get(asset.fileObject.originalStorageKey);
    if (!object) {
      manifest.push({ assetId: asset.id, filename: asset.filename, status: "FAILED" });
      continue;
    }
    let filename = safeDownloadFilename(asset.filename);
    if (usedFilenames.has(filename)) filename = `${asset.id}-${filename}`;
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
