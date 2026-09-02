# Development Plan

## Phase 0: Business Rules and Data Contract

Define asset-group ownership, channel reuse, country and image-type enumerations, file limits, retention, and permissions. Publish the Prisma model and API contract before implementation.

**Acceptance:** every business field has an owner and validation rule; product decisions resolve whether an original can belong to multiple delivery contexts.

## Phase 1: Application Foundation

Status: completed for the static library page. Next.js, TypeScript strict mode, linting, type checking, build scripts, typed components, and centralized mock data are in place. The static page supports browsing, filters, preview, multi-selection, density switching, and responsive layouts.

**Acceptance:** `lint`, `typecheck`, `test`, and `build` pass; filters, preview, selection, and responsive layouts match approved prototype behavior using mock data.

## Phase 2: Authentication and Metadata

Status: authentication, authorization and database-backed library browsing are completed. Auth.js Credentials login, Prisma roles and library relations, protected paginated query APIs, URL-backed filters, development seed data, and unit tests are in place. The browsing UI now treats each SPU as the business-facing asset library layer before showing second-level image assets. Asset metadata mutations are implemented in application code and await the same PostgreSQL-backed integration verification as library operations.

**Acceptance:** unauthenticated requests cannot access protected routes; role checks are verified on UI and server; metadata persists after restart and validation errors are consistent.

## Phase 3: Local File Storage

Status: completed in the application code, pending PostgreSQL-backed integration verification. `StorageService` and `LocalStorageService` isolate local filesystem access. Uploads use an idempotency key, a temporary directory, Sharp MIME/dimension validation, SHA-256 checksums, and WebP thumbnail/preview derivatives. ZIP uploads map the approved language folders and common country-folder variants to country groups, recover GBK-encoded Chinese ZIP paths where available, process groups sequentially, and create or reuse the Product and each matching country asset group from the upload context. Active assets are served only through authenticated content endpoints; deletion failures are recorded as `DELETE_FAILED`.

**Acceptance:** uploaded originals survive restart, retain bytes and MIME type, have an `assetGroupId`, generate thumbnails, and can be read without revealing absolute paths. Verify these against configured PostgreSQL before promoting the phase.

## Phase 4: Library Operations

Status: completed in application code, pending PostgreSQL-backed integration verification. Asset detail editing, asset-group moves, single and ZIP batch downloads, per-item download preflight results, soft delete, recycle-bin restore, operation logs, duplicate SHA-256 reuse notices, and `FileObject` cleanup eligibility are implemented.

**Acceptance:** large result sets paginate correctly; batch jobs report individual errors; audit records exist for asset changes and downloads; soft deletion never deletes a referenced file object; automated tests cover authorization and storage failures.

## Phase 4.5: Super Admin Operations

Status: operational console, user-facing content consumption, ZIP download batch tracking, upload failure reporting, operations reporting, asset-group governance, data-quality checks, audit-log review, read-only policy settings, storage health checks, deployment preflight checks, and deployment runbook checklist expanded. `SUPER_ADMIN` users can open `/admin` from the library header, inspect expanded dashboard metrics and distribution panels, filter/export date-range operations reports for upload, download, asset-growth, and failure trends, create/edit/enable/disable users, reset passwords, review user and role overview, recent download audit records, filter/paginate/export ZIP download batches with item-level details, filter/paginate/export upload tasks and failed-file details, jump from an upload task back to the matching library or re-upload context, filter/export SPU coverage and missing asset-group reports, filter/export SPU naming, asset-group field, filename, derivative, dimension, duplicate, sort-order, and failed-asset quality issues, filter/paginate/export full audit logs with detail JSON, review effective upload, ZIP, download, permission, taxonomy, content, and storage policies without editing them, run storage read/write/delete probes, review cleanup candidates, safely clean file objects with no active asset references, review app version, key environment configuration, database connectivity, migration status, active super-admin coverage, follow a browser-local deployment checklist for first deployment, migration rollout, backup, isolated restore, and post-release verification, publish/edit announcements, create/edit documentation pages, and review online messages. Announcement and documentation content is persisted through Prisma models with role-based visibility metadata, publication status, announcement timing, pinning, read-count support, and audit logs. Permitted users can now see published announcements on the library page, mark announcements as read, and read published role-visible documents at `/docs`. Logged-in users can submit messages and see only their own history, while the super-admin panel refreshes the complete message feed every 10 seconds. The next acceptance work is safer production deployment rehearsal and deeper long-range capacity planning.

**Acceptance:** super admin routes are inaccessible to non-admin users; operations reports summarize date-range asset growth, upload batches, failures, download batches, downloaded asset volume, and ranking breakdowns with CSV export; data-quality checks identify naming, derivative, dimension, duplicate, sort-order, field-policy, and failed-asset issues with filters, library links, and CSV export; read-only policy settings match actual code and environment-derived upload, ZIP, download, permission, taxonomy, content, and storage rules; system preflight reports environment, database, migration, active super-admin, storage probe, file-existence, and cleanup readiness without exposing secrets; deployment runbook covers first deployment, migration rollout, backup, isolated restore, and post-release verification without executing destructive commands; ZIP download batch records answer who downloaded which archive, when, from which IP/User-Agent, and which assets succeeded or failed; upload-task reports identify failed files by user, SPU, date, error code, and error message with CSV export and re-upload context links; asset-group governance identifies missing countries, missing image types, failed assets, and empty SPUs with CSV export; audit logs are searchable by action, actor, object, and date with CSV export; storage health reports current driver status, existence-scan results, cleanup candidates, and safe cleanup outcomes; user, announcement, and documentation mutations are audited; announcement and documentation publishing has role-based visibility; published content is exposed only to permitted users; announcement read state persists per user.

## Phase 5: LAN Deployment Readiness

Status: in progress. The production migration command and deployment, backup, recovery, and verification runbook are documented. The remaining acceptance work is a rehearsal against an isolated configured PostgreSQL deployment.
Upload load-test guidance and a reusable HTTP upload load script are now included so the rehearsal can validate multi-user upload behavior before promotion.

Local rehearsal can use `npm run clear:assets` to remove uploaded asset metadata and referenced local storage objects while preserving users, channels, and categories.

**Acceptance:** a clean machine can deploy from documentation; database backup and file restore are rehearsed; no secret or absolute storage path is committed.

## Phase 6: NAS Integration

Only after approval, configure a NAS-backed storage adapter or server-side mounted share.

**Acceptance:** no browser or database contract changes are required; upload, preview, download, delete, and recovery pass the existing storage integration tests against NAS-backed storage.

## Current Verification Pass

Status: unit coverage and the integration/E2E test suites are implemented. Unit checks run without external dependencies. The integration suite deliberately requires `TEST_DATABASE_URL`, `TEST_STORAGE_ROOT`, `TEST_ADMIN_EMAIL`, and `TEST_ADMIN_PASSWORD`; the Playwright suite deliberately requires `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD`. Missing prerequisites fail the command with a clear error rather than skipping tests.

**Acceptance:** `lint`, `typecheck`, `test`, and `build` pass; `test:integration` passes against an isolated seeded PostgreSQL database; `e2e` passes against a running test deployment with Chromium installed. See `docs/deployment.md` for the required setup.
