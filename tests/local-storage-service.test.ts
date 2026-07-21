import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LocalStorageService } from "../lib/storage/local-storage-service";

async function readStorageObject(service: LocalStorageService, key: string) {
  const object = await service.get(key);
  if (!object) return null;
  const chunks: Buffer[] = [];
  for await (const chunk of object.body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

describe("LocalStorageService", () => {
  it("writes, reads, moves, and deletes storage keys without exposing a path", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "image-library-storage-"));
    const storage = new LocalStorageService(root);

    try {
      await storage.put({ key: "temporary/request-1/image", body: Buffer.from("image-bytes") });
      expect(await storage.exists("temporary/request-1/image")).toBe(true);
      expect(await readStorageObject(storage, "temporary/request-1/image")).toBe("image-bytes");

      await storage.move("temporary/request-1/image", "originals/file-1.jpg");
      expect(await storage.exists("temporary/request-1/image")).toBe(false);
      expect(await readStorageObject(storage, "originals/file-1.jpg")).toBe("image-bytes");
      expect(storage.getPublicOrDownloadUrl("originals/file-1.jpg")).toBeNull();
      await expect(storage.put({ key: "../outside", body: Buffer.from("blocked") })).rejects.toThrow("INVALID_STORAGE_KEY");

      expect(await storage.delete("originals/file-1.jpg")).toBe(true);
      expect(await storage.delete("originals/file-1.jpg")).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
