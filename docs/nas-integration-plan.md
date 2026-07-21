# NAS Integration Plan

NAS is out of scope for the current implementation. The browser, API paths, database schema and `Asset`/`FileObject` relationships must remain unchanged when it is added.

## Files to Replace or Extend

| File | NAS change |
| --- | --- |
| `lib/storage/local-storage-service.ts` | Keep it for local environments; add a NAS-backed adapter instead of embedding NAS calls in routes. |
| `lib/storage/index.ts` | Extend driver selection from `local` to a named NAS driver using environment configuration. |
| `lib/storage/storage-service.ts` | Preserve the interface. Add methods only when every driver can implement them. |
| `.env.example` | Add non-secret NAS connection or mount configuration names and document them. Do not add credentials to Git. |
| `docs/storage.md` | Add the NAS driver's operational and recovery behavior. |
| `tests/local-storage-service.test.ts` | Promote contract assertions into a shared storage-driver test suite and run it against NAS staging. |

## Configuration Shape

The intended configuration is a driver selector plus a server-only root or endpoint. For a mounted share, use a server-resolved mount root such as `NAS_STORAGE_ROOT`; for an object-style NAS API, use endpoint and credentials from a secret manager. Database rows continue to store only relative `storageKey` values.

## Migration Steps

1. Implement `NasStorageService` behind `StorageService`.
2. Run the shared storage contract tests against a NAS staging location.
3. Copy existing local keys to NAS without changing `FileObject` records.
4. Switch `STORAGE_DRIVER` in a maintenance window.
5. Verify upload, preview, single download, ZIP download, soft delete and restore.
6. Keep the local root read-only until backup and rollback validation succeeds.

No route, page, React component, Prisma relation or stored `storageKey` should be changed for this migration.
