# Development Plan

## Phase 0: Business Rules and Data Contract

Define asset-group ownership, channel reuse, country and image-type enumerations, file limits, retention, and permissions. Publish the Prisma model and API contract before implementation.

**Acceptance:** every business field has an owner and validation rule; product decisions resolve whether an original can belong to multiple delivery contexts.

## Phase 1: Application Foundation

Status: completed for the static library page. Next.js, TypeScript strict mode, linting, type checking, build scripts, typed components, and centralized mock data are in place. The static page supports browsing, filters, preview, multi-selection, density switching, and responsive layouts.

**Acceptance:** `lint`, `typecheck`, `test`, and `build` pass; filters, preview, selection, and responsive layouts match approved prototype behavior using mock data.

## Phase 2: Authentication and Metadata

Status: authentication, authorization and database-backed library browsing are completed. Auth.js Credentials login, Prisma roles and library relations, protected paginated query APIs, URL-backed filters, development seed data, and unit tests are in place. Asset metadata mutations remain pending.

**Acceptance:** unauthenticated requests cannot access protected routes; role checks are verified on UI and server; metadata persists after restart and validation errors are consistent.

## Phase 3: Local File Storage

Status: completed in the application code, pending PostgreSQL-backed integration verification. `StorageService` and `LocalStorageService` isolate local filesystem access. Uploads use an idempotency key, a temporary directory, Sharp MIME/dimension validation, SHA-256 checksums, and WebP thumbnail/preview derivatives. Active assets are served only through authenticated content endpoints; deletion failures are recorded as `DELETE_FAILED`.

**Acceptance:** uploaded originals survive restart, retain bytes and MIME type, have an `assetGroupId`, generate thumbnails, and can be read without revealing absolute paths. Verify these against configured PostgreSQL before promoting the phase.

## Phase 4: Library Operations

Status: completed in application code, pending PostgreSQL-backed integration verification. Asset detail editing, asset-group moves, single and ZIP batch downloads, per-item download preflight results, soft delete, recycle-bin restore, operation logs, duplicate SHA-256 reuse notices, and `FileObject` cleanup eligibility are implemented.

**Acceptance:** large result sets paginate correctly; batch jobs report individual errors; audit records exist for asset changes and downloads; soft deletion never deletes a referenced file object; automated tests cover authorization and storage failures.

## Phase 5: LAN Deployment Readiness

Document local deployment, backups, environment configuration, migration process, observability, and recovery procedures.

**Acceptance:** a clean machine can deploy from documentation; database backup and file restore are rehearsed; no secret or absolute storage path is committed.

## Phase 6: NAS Integration

Only after approval, configure a NAS-backed storage adapter or server-side mounted share.

**Acceptance:** no browser or database contract changes are required; upload, preview, download, delete, and recovery pass the existing storage integration tests against NAS-backed storage.

## Current Verification Pass

Status: unit coverage and the integration/E2E test suites are implemented. Unit checks run without external dependencies. The integration suite deliberately requires `TEST_DATABASE_URL`, `TEST_STORAGE_ROOT`, `TEST_ADMIN_EMAIL`, and `TEST_ADMIN_PASSWORD`; the Playwright suite deliberately requires `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD`. Missing prerequisites fail the command with a clear error rather than skipping tests.

**Acceptance:** `lint`, `typecheck`, `test`, and `build` pass; `test:integration` passes against an isolated seeded PostgreSQL database; `e2e` passes against a running test deployment with Chromium installed. See `docs/deployment.md` for the required setup.
