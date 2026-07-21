export type AssetStorageKeys = {
  temporaryOriginalKey: string;
  originalKey: string;
  temporaryThumbnailKey: string;
  temporaryPreviewKey: string;
  thumbnailKey: string;
  previewKey: string;
};

function validateIdentifier(identifier: string) {
  if (!/^[a-z0-9-]{3,128}$/i.test(identifier)) throw new Error("INVALID_STORAGE_IDENTIFIER");
  return identifier;
}

export function createAssetStorageKeys(uploadRequestId: string, fileId: string): AssetStorageKeys {
  const requestId = validateIdentifier(uploadRequestId);
  const assetFileId = validateIdentifier(fileId);
  return {
    temporaryOriginalKey: `temporary/${requestId}/${assetFileId}.source`,
    originalKey: `originals/${assetFileId}`,
    temporaryThumbnailKey: `temporary/${requestId}/${assetFileId}.thumbnail.webp`,
    temporaryPreviewKey: `temporary/${requestId}/${assetFileId}.preview.webp`,
    thumbnailKey: `thumbnails/${assetFileId}.webp`,
    previewKey: `previews/${assetFileId}.webp`,
  };
}
