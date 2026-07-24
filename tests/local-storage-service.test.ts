import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "vitest";
import { LocalStorageService } from "../lib/storage/local-storage-service";
import { expectStorageServiceContract } from "./storage-contract";

describe("LocalStorageService", () => {
  it("satisfies the storage driver contract", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "image-library-storage-"));
    const storage = new LocalStorageService(root);

    try {
      await expectStorageServiceContract(storage);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
