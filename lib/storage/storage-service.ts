import type { Readable } from "node:stream";

export type StoragePutInput = {
  key: string;
  body: Readable | Uint8Array;
};

export type StorageObject = {
  body: Readable;
};

export interface StorageService {
  put(input: StoragePutInput): Promise<void>;
  get(key: string): Promise<StorageObject | null>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  move(sourceKey: string, destinationKey: string): Promise<void>;
  getPublicOrDownloadUrl(key: string): string | null;
}
