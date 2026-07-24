import type { StorageService } from "../lib/storage/storage-service";
import { expect } from "vitest";

async function readStorageObject(service: StorageService, key: string) {
  const object = await service.get(key);
  if (!object) return null;
  const chunks: Buffer[] = [];
  for await (const chunk of object.body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

export async function expectStorageServiceContract(service: StorageService) {
  await service.put({ key: "temporary/request-1/image", body: Buffer.from("image-bytes") });
  expect(await service.exists("temporary/request-1/image")).toBe(true);
  expect(await readStorageObject(service, "temporary/request-1/image")).toBe("image-bytes");

  await service.move("temporary/request-1/image", "originals/file-1.jpg");
  expect(await service.exists("temporary/request-1/image")).toBe(false);
  expect(await readStorageObject(service, "originals/file-1.jpg")).toBe("image-bytes");
  expect(service.getPublicOrDownloadUrl("originals/file-1.jpg")).toBeNull();

  await expect(service.put({ key: "../outside", body: Buffer.from("blocked") })).rejects.toThrow("INVALID_STORAGE_KEY");

  await Promise.all([
    service.put({ key: "temporary/concurrent/a", body: Buffer.from("a") }),
    service.put({ key: "temporary/concurrent/b", body: Buffer.from("b") }),
  ]);
  expect(await readStorageObject(service, "temporary/concurrent/a")).toBe("a");
  expect(await readStorageObject(service, "temporary/concurrent/b")).toBe("b");

  expect(await service.delete("originals/file-1.jpg")).toBe(true);
  expect(await service.delete("originals/file-1.jpg")).toBe(false);
  expect(await service.delete("temporary/concurrent/a")).toBe(true);
  expect(await service.delete("temporary/concurrent/b")).toBe(true);
}
