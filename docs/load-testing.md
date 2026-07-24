# Load Testing

Use this checklist after the isolated deployment rehearsal is running with a test PostgreSQL database and a disposable storage root. Never run load tests against production data or a shared storage root.

## Upload Load Test

Start the application against the isolated test environment, then run:

```bash
LOAD_BASE_URL="http://127.0.0.1:3000" \
LOAD_ADMIN_EMAIL="admin@example.test" \
LOAD_ADMIN_PASSWORD="test-only-password" \
LOAD_UPLOADS_PER_USER="10" \
LOAD_FILES_PER_UPLOAD="2" \
LOAD_CLIENT_CONCURRENCY="5" \
npm run load:uploads
```

For true multi-user testing, create several `ASSET_ADMIN` accounts and provide credentials as JSON:

```bash
LOAD_USERS_JSON='[
  {"identifier":"uploader-1@example.test","password":"test-only-password"},
  {"identifier":"uploader-2@example.test","password":"test-only-password"},
  {"identifier":"uploader-3@example.test","password":"test-only-password"}
]' npm run load:uploads
```

The script logs in through Auth.js, fetches real channels and categories, and posts to `/api/uploads/context` with generated PNG images. It reports request count, success/failure count, p50, p95, and max latency.

## Suggested Stages

Run the stages in order and inspect the admin upload-task and storage-health panels after each one.

| Stage | Users | Uploads per user | Files per upload | Client concurrency | Expected result |
| --- | ---: | ---: | ---: | ---: | --- |
| Smoke | 1 | 2 | 1 | 1 | All uploads succeed. |
| Small team | 5 | 5 | 2 | 5 | All uploads succeed; p95 remains under 800 ms on a LAN test host. |
| Busy upload window | 10 | 10 | 3 | 8 | No missing thumbnails/previews; upload tasks are completed or partial with clear file errors. |
| Stress probe | 20 | 10 | 3 | 12 | Failures, if any, are bounded and recorded; the app recovers without restart. |

## Post-Test Checks

Run the automated storage consistency check after each stage:

```bash
DATABASE_URL="postgresql://.../image_library_test?schema=public" \
LOCAL_STORAGE_ROOT="./data/test-storage" \
npm run verify:storage
```

- `UploadRequest` rows match the request count and have `COMPLETED`, `PARTIAL`, or `FAILED` status.
- Every `ACTIVE` asset has an `ACTIVE` `FileObject`.
- Every active file object has original, thumbnail, and preview keys that exist in storage.
- The admin storage-health panel does not report unexpected missing derivatives.
- Batch download still works while upload load is running.
- Re-running with the same deployment leaves no `temporary/` files that grow without bound.

## Capacity Notes

`UPLOAD_PROCESSING_CONCURRENCY` controls how many images a single normal upload request processes at once. Keep it low for small LAN hosts. Increase only after CPU, memory, disk I/O, and PostgreSQL connection metrics stay healthy during the stages above.

ZIP uploads still process each resolved country group sequentially. Test ZIP separately with realistic archives before enabling large ZIP limits for operators.
