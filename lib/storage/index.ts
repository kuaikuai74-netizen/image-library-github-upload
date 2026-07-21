import { LocalStorageService } from "@/lib/storage/local-storage-service";
import type { StorageService } from "@/lib/storage/storage-service";

let storageService: StorageService | undefined;

export function getStorageService(): StorageService {
  if (storageService) return storageService;
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver !== "local") throw new Error("UNSUPPORTED_STORAGE_DRIVER");
  storageService = new LocalStorageService(process.env.LOCAL_STORAGE_ROOT ?? "./data/storage");
  return storageService;
}
