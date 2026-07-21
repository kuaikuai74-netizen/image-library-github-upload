import { describe, expect, it } from "vitest";
import { createAssetStorageKeys } from "../lib/storage/storage-keys";

describe("asset storage keys", () => {
  it("creates separated temporary and final keys from server-generated identifiers", () => {
    const keys = createAssetStorageKeys("request-123", "file-456");
    expect(keys).toEqual({
      temporaryOriginalKey: "temporary/request-123/file-456.source",
      originalKey: "originals/file-456",
      temporaryThumbnailKey: "temporary/request-123/file-456.thumbnail.webp",
      temporaryPreviewKey: "temporary/request-123/file-456.preview.webp",
      thumbnailKey: "thumbnails/file-456.webp",
      previewKey: "previews/file-456.webp",
    });
  });

  it("rejects path-like identifiers", () => {
    expect(() => createAssetStorageKeys("request-123", "../file")).toThrow("INVALID_STORAGE_IDENTIFIER");
  });
});
