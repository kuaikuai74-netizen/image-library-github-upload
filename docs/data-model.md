# Data Model

## Ownership

`Asset` is the business-facing record. It belongs to exactly one `AssetGroup`, records its display metadata and lifecycle state, and can be moved to another group. `FileObject` owns the physical original and generated derivative keys. Multiple assets may reference a single file object when an upload has the same SHA-256 digest.

```text
User -> UploadRequest -> Asset -> AssetGroup -> Product -> Category
                          |
                          -> FileObject
                          -> AuditLog
```

## Core Records

| Record | Important fields | Rules |
| --- | --- | --- |
| `User` | email, username, passwordHash, role, status | Password hashes only; `DISABLED` users cannot authenticate. |
| `AssetGroup` | channelId, categoryId, productId, countryCode, assetType | Unique per channel, product, country and group type. |
| `Asset` | assetGroupId, fileObjectId, assetType, color, notes, sortOrder, status | Exactly one group; no storage key or absolute path. |
| `FileObject` | originalStorageKey, derivative keys, sha256, MIME, dimensions, cleanupStatus | Internal storage metadata only; never returned to browsers. |
| `UploadRequest` | idempotencyKey, uploaderId, status | Prevents duplicate submission from producing another batch. |
| `AuditLog` | actorId, action, objectType, objectId, assetId, createdAt | Appends an auditable management event. |

## Lifecycles

`Asset`: `PENDING` -> `UPLOADING` -> `PROCESSING` -> `ACTIVE`; failures become `FAILED`; user deletion becomes `DELETED`.

`FileObject`: `PROCESSING` -> `ACTIVE` or `FAILED`. A file object with no `ACTIVE` asset references moves from cleanup `NONE` to `PENDING`. Restore moves it back to `NONE`. This project has no automatic physical cleanup job.

## Query and Index Rules

- List queries always filter `Asset.status = ACTIVE`.
- Asset list ordering is `sortOrder ASC, createdAt DESC`.
- SHA-256 and `FileObject.status` are indexed for duplicate-file lookup.
- Group/status, uploader, color, filename, SKU and deleted timestamp are indexed for management views.
- `AuditLog` is indexed by target and actor with timestamp ordering.

## Migration Rule

Run Prisma migrations only against the intended environment. Before adding a migration that changes `FileObject` or `Asset`, back up both PostgreSQL metadata and the storage root. A migration must never derive an absolute path from a stored key.
