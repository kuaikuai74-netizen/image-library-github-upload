# Architecture

## Scope

The first production-ready version uses a Next.js application, Auth.js, PostgreSQL via Prisma, Sharp image processing, and local server-side file storage. UGREEN NAS integration is explicitly out of scope for this phase.

## System Boundaries

```text
Browser -> Next.js UI -> authenticated server route/action -> service layer
                                                    |-> PostgreSQL metadata
                                                    |-> ZIP parser -> country asset groups
                                                    |-> StorageService -> local files
                                                    |-> Sharp -> thumbnails
```

The browser communicates only with authenticated application endpoints. It never reads or writes a local filesystem, shared drive, or NAS.

## Storage Contract

`StorageService` owns file operations. The current `LocalStorageService` implements `put`, `get`, `delete`, `exists`, `move`, and `getPublicOrDownloadUrl` by `storageKey`.

- `FileObject` records store `storageKey`, MIME type, file size, checksum, and derivative metadata.
- Absolute paths exist only inside the local storage adapter.
- Original uploads remain byte-for-byte intact.
- Sharp creates separate thumbnail or preview storage keys.
- Uploads enter `temporary/<requestId>/` before validation and derivative generation. Only successful moves to final keys can transition an asset to `ACTIVE`.
- Only `ACTIVE` assets are returned by the library query and content endpoint.
- `UploadRequest.idempotencyKey` prevents a retried client submission from creating another upload batch.
- ZIP uploads are parsed server-side from the request body without extracting archive entries to disk. Approved language folders map to country codes; each resolved country group gets a deterministic derived idempotency key and is processed sequentially. The service creates or reuses the Product and country asset group from the supplied context; a newly created Product uses the SPU as its name.
- Physical deletion is deferred to a later maintenance workflow and is never performed by an asset soft-delete request.
- `FileObject` owns immutable original and derivative keys. `Asset` owns its asset-group relationship, display metadata, notes, sort order, and soft-delete lifecycle. Several assets may reference one file object without exposing its keys to browsers.
- A soft deletion changes only `Asset.status` to `DELETED`. Once no `ACTIVE` asset references the file object, it becomes `PENDING` for a separate physical-cleanup workflow; this phase never deletes it automatically.
- Future NAS integration implements or reconfigures the storage adapter; it must not change API contracts, database fields, or browser code.

## Core Data Model

| Model | Purpose |
| --- | --- |
| `User`, `Role` | Identity and authorization. |
| `Channel` | Sales or publishing channel. |
| `Category` | Product category. |
| `Product` | Product/SPU. |
| `Sku` | SKU and color/specification relationship. |
| `AssetGroup` | A business grouping for channel, country, image type, and product/SPU. |
| `Asset` | One business-facing asset with `assetGroupId`, display metadata, sort order, notes, and lifecycle status. |
| `FileObject` | One physical original plus generated derivatives, SHA-256, storage keys, and cleanup eligibility. |
| `AuditLog` | Actor, operation, target object, details, and timestamp for management actions. |
| `AssetTag` | Searchable labels. |
| `UploadRequest` | Idempotent batch upload status and its per-file assets. |

Every `Asset` is created with an `assetGroupId`. The group, product, channel, country, image type, and related SKU references are database relationships, not filenames or browser state.

The browser presents `Product`/SPU as the business-facing asset library layer. A single SPU counts as one visible asset library in category totals, even when PostgreSQL stores several `AssetGroup` rows for different countries or image types. Users first choose the SPU library, then filter and manage the second-level image assets inside it.
The first-level SPU library view supports selecting one or multiple libraries and requesting one server-generated ZIP containing every active original image in those libraries. The archive groups files by country, image type, and the upload-context `other` value stored in the asset color field, while downloads still pass through authenticated server routes and `StorageService`.

`AssetGroup` is uniquely identified by channel, product, country code, and image type. `Asset` indexes its group, uploader, color, SKU, and filename. The list API applies filters in PostgreSQL and returns a bounded page rather than materializing the entire library in the browser.

## Security

- Auth.js Credentials Provider accepts username or email plus password. Passwords are stored only as bcrypt hashes.
- Sessions use signed JWT cookies. Every protected page and API request resolves the user from PostgreSQL again and rejects missing or `DISABLED` users.
- Roles are `SUPER_ADMIN`, `ASSET_ADMIN`, `UPLOADER`, and `VIEWER`. Server-side guards enforce permissions before routes return data or begin a mutation.
- Authorize every route/action on the server; hide unavailable UI controls as a secondary safeguard.
- Validate route and form parameters before entering services.
- Keep secrets in `.env`, never in committed files.
- Apply file type, size, image decode, and checksum validation server-side.
- Validate ZIP extension, entry count, compressed and declared uncompressed limits, and archive paths before reading image bytes; ignore only non-image or system metadata entries.
- Do not expose storage root paths, database credentials, or NAS mount details in API responses.
- Use a single `{ data }` success envelope and `{ error: { code, message } }` failure envelope for library APIs.

## Error Handling

Use one typed application-error format with a stable code, safe user message, and request context for server logs. Upload requests record per-file failures without losing successful files in the same batch.

## Verification Boundaries

- Unit tests cover rules that do not require PostgreSQL: authorization, storage key construction, storage adapter behavior, decoded image formats, ordering and duplicate-file eligibility.
- Integration tests require an isolated PostgreSQL schema and local test storage. They exercise credentials authentication, query paging, upload persistence, duplicate reuse, soft delete and restore.
- Playwright tests execute the administrator workflow through the browser. They require a seeded administrator, a running application and an installed Chromium browser.
- No test sends browser code to the filesystem or exposes a `FileObject` storage key. Download and preview tests use authenticated routes only.

## Operations

- Production and LAN deployments apply committed database migrations through `npm run db:deploy` (`prisma migrate deploy`). `npm run db:migrate` is a development-only command because it can create new migrations.
- PostgreSQL metadata and the storage root form one recovery unit. Back up and restore them together into an isolated environment; database records continue to contain relative storage keys only.
