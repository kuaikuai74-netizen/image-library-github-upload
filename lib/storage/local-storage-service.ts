import { access, copyFile, mkdir, rename, rm } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { StorageObject, StoragePutInput, StorageService } from "@/lib/storage/storage-service";

function normalizeKey(key: string) {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || path.posix.isAbsolute(normalized)) {
    throw new Error("INVALID_STORAGE_KEY");
  }
  return normalized;
}

export class LocalStorageService implements StorageService {
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  async put({ key, body }: StoragePutInput) {
    const destination = this.resolvePath(key);
    await mkdir(path.dirname(destination), { recursive: true });
    const source = body instanceof Uint8Array ? Readable.from([body]) : body;
    await pipeline(source, createWriteStream(destination, { flags: "wx" }));
  }

  async get(key: string): Promise<StorageObject | null> {
    const source = this.resolvePath(key);
    if (!(await this.exists(key))) return null;
    return { body: createReadStream(source) };
  }

  async delete(key: string) {
    try {
      await rm(this.resolvePath(key), { force: false });
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }

  async exists(key: string) {
    try {
      await access(this.resolvePath(key));
      return true;
    } catch {
      return false;
    }
  }

  async move(sourceKey: string, destinationKey: string) {
    const source = this.resolvePath(sourceKey);
    const destination = this.resolvePath(destinationKey);
    await mkdir(path.dirname(destination), { recursive: true });
    try {
      await rename(source, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
      await copyFile(source, destination);
      await rm(source);
    }
  }

  getPublicOrDownloadUrl(key: string) {
    void key;
    return null;
  }

  private resolvePath(key: string) {
    const candidate = path.resolve(this.root, ...normalizeKey(key).split("/"));
    if (candidate !== this.root && !candidate.startsWith(`${this.root}${path.sep}`)) {
      throw new Error("INVALID_STORAGE_KEY");
    }
    return candidate;
  }
}
