# Local Storage

## Configuration

```dotenv
STORAGE_DRIVER="local"
LOCAL_STORAGE_ROOT="./data/storage"
MAX_UPLOAD_BYTES="26214400"
UPLOAD_PROCESSING_CONCURRENCY="3"
MAX_ZIP_UPLOAD_BYTES="262144000"
MAX_ZIP_ENTRIES="500"
MAX_ZIP_UNCOMPRESSED_BYTES="314572800"
```

`LOCAL_STORAGE_ROOT` is server-only and is ignored by Git. Browser code must use authenticated preview and download routes, never filesystem paths.

## Storage Contract

`StorageService` defines `put`, `get`, `delete`, `exists`, `move`, and `getPublicOrDownloadUrl`. The current [LocalStorageService](../lib/storage/local-storage-service.ts) resolves relative keys beneath the configured root and rejects traversal.

The service uses these relative key families:

| Purpose | Key prefix |
| --- | --- |
| In-flight original and derivatives | `temporary/<uploadRequestId>/` |
| Original uploads | `originals/<uuid>.<extension>` |
| Thumbnails | `thumbnails/<uuid>.webp` |
| Previews | `previews/<uuid>.webp` |
| Development seed files | `seed/` |

## Upload Safety

1. Generate server-side UUID-based keys.
2. Enforce `MAX_UPLOAD_BYTES`.
3. Process normal image uploads with at most `UPLOAD_PROCESSING_CONCURRENCY` files in flight per request.
4. Decode with Sharp and accept only JPEG, PNG or WEBP based on actual bytes.
5. Calculate SHA-256 before finalizing the object.
6. Write temporary objects, create derivatives, then move them to final keys.
7. Mark the file object and asset `ACTIVE` only after all moves succeed.
8. Reuse an active matching SHA-256 file object and create another business `Asset` when appropriate.
9. ZIP uploads remain in server memory, validate entry names and declared uncompressed sizes, and process each country sequentially. They recognize only the approved language directories, create or reuse the Product and country asset group from the upload context, and never extract files to the storage root.

## Retention and Deletion

Soft deletion changes only the `Asset` row. It never calls `StorageService.delete`. When no active asset references a file object, its cleanup state becomes `PENDING`. A future worker may physically delete only after rechecking that condition transactionally; that worker is intentionally not implemented in this phase.
