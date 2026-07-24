# Deployment and Verification

## Local Prerequisites

- Node.js compatible with Next.js 16.
- PostgreSQL reachable from the Next.js server.
- A server-writable local storage root outside the source checkout when deployed.
- `pg_dump`, `pg_restore`, and `tar` available to the operator performing backup or recovery.

## First Deployment

1. Copy `.env.example` to `.env` outside source control and replace every placeholder. Set `LOCAL_STORAGE_ROOT` to a directory that is writable by the service account and outside the release checkout. Set `MAX_ZIP_UPLOAD_BYTES`, `MAX_ZIP_ENTRIES`, and `MAX_ZIP_UNCOMPRESSED_BYTES` to limits the application host can safely process; proxy request limits must allow the configured ZIP size.
2. Run `npm ci`, `npm run db:generate`, and `npm run db:deploy`. `db:deploy` applies only committed migrations; never run `npm run db:migrate` in a deployed environment.
3. For the first local administrator only, set the three `DEV_ADMIN_*` values and run `npm run db:seed`. The seed upserts that account and does not write its password to the repository.
4. Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` from the release candidate.
5. For an isolated rehearsal, start the app and run `npm run test:integration`, `npm run e2e`, and the staged upload load test in [load-testing.md](load-testing.md).
   Run `npm run verify:storage` after upload and download checks to confirm active database records still have physical originals, thumbnails, and previews.
6. Start the service with `npm run start` after a successful build. Keep application stdout and stderr with the process manager, and monitor database reachability, storage-root free space, upload failures, CPU, memory, and disk I/O during upload windows.

## Migration Rollout

1. Take a paired PostgreSQL and storage-root backup before changing the schema.
2. Stop writes or place the application in a maintenance window when the change requires it.
3. Deploy the release, run `npm run db:deploy`, then start the service and verify login, preview, and download through authenticated routes.
4. Keep the prior release and the paired backup until verification is complete. Do not edit database storage keys during a rollback.

## Test Environments

Use a database that is separate from development and production. The integration test command requires all of the following values and exits with an error if one is missing:

```dotenv
TEST_DATABASE_URL="postgresql://.../image_library_test?schema=public"
TEST_STORAGE_ROOT="./data/test-storage"
TEST_ADMIN_EMAIL="admin@example.test"
TEST_ADMIN_PASSWORD="test-only-password"
```

Before preparing the test database, explicitly copy these values into the Prisma and seed variables in the same shell:

```powershell
$env:DATABASE_URL=$env:TEST_DATABASE_URL
$env:DEV_ADMIN_EMAIL=$env:TEST_ADMIN_EMAIL
$env:DEV_ADMIN_USERNAME="test-admin"
$env:DEV_ADMIN_PASSWORD=$env:TEST_ADMIN_PASSWORD
npm run db:deploy
npm run db:seed
```

Then run `npm run test:integration`. Do not point `TEST_DATABASE_URL`, `DATABASE_URL`, or `LOCAL_STORAGE_ROOT` at a shared environment. `TEST_STORAGE_ROOT` is intentionally ignored by Git.

For browser tests, start the application in one terminal with the test database and storage root:

```powershell
$env:DATABASE_URL=$env:TEST_DATABASE_URL
$env:LOCAL_STORAGE_ROOT=$env:TEST_STORAGE_ROOT
npm run dev
```

During local development, `npm run dev` runs `prisma generate` and `prisma migrate deploy` before starting Next.js. After adding or changing Prisma models, restart the dev server so the running Node process loads the regenerated Prisma Client.

In another terminal, set:

```dotenv
E2E_BASE_URL="http://127.0.0.1:3000"
E2E_ADMIN_EMAIL="admin@example.test"
E2E_ADMIN_PASSWORD="test-only-password"
```

Install Chromium once with `npx playwright install chromium`, then run `npm run e2e`.

## Backup and Recovery

Back up PostgreSQL metadata and the configured storage root as a pair while writes are paused or during a maintenance window. Give both files the same backup identifier and store the checksum beside them.

```bash
export IMAGE_LIBRARY_BACKUP_DIR="../image-library-backups"
export IMAGE_LIBRARY_BACKUP_ID="$(date +%Y%m%dT%H%M%SZ)"
mkdir -p "$IMAGE_LIBRARY_BACKUP_DIR"
pg_dump --format=custom --file="$IMAGE_LIBRARY_BACKUP_DIR/$IMAGE_LIBRARY_BACKUP_ID.database.dump" "$DATABASE_URL"
tar -C "$LOCAL_STORAGE_ROOT" -czf "$IMAGE_LIBRARY_BACKUP_DIR/$IMAGE_LIBRARY_BACKUP_ID.storage.tar.gz" .
shasum -a 256 "$IMAGE_LIBRARY_BACKUP_DIR/$IMAGE_LIBRARY_BACKUP_ID.database.dump" "$IMAGE_LIBRARY_BACKUP_DIR/$IMAGE_LIBRARY_BACKUP_ID.storage.tar.gz" > "$IMAGE_LIBRARY_BACKUP_DIR/$IMAGE_LIBRARY_BACKUP_ID.sha256"
```

Restore only into an isolated database and an empty isolated storage root. Confirm the checksum first, then restore the database and files as a matched pair:

```bash
shasum -a 256 -c "$IMAGE_LIBRARY_BACKUP_DIR/$IMAGE_LIBRARY_BACKUP_ID.sha256"
export IMAGE_LIBRARY_RESTORE_STORAGE_ROOT="../image-library-restore-storage"
mkdir -p "$IMAGE_LIBRARY_RESTORE_STORAGE_ROOT"
pg_restore --clean --if-exists --no-owner --dbname="$IMAGE_LIBRARY_RESTORE_DATABASE_URL" "$IMAGE_LIBRARY_BACKUP_DIR/$IMAGE_LIBRARY_BACKUP_ID.database.dump"
tar -C "$IMAGE_LIBRARY_RESTORE_STORAGE_ROOT" -xzf "$IMAGE_LIBRARY_BACKUP_DIR/$IMAGE_LIBRARY_BACKUP_ID.storage.tar.gz"
```

Start the application against the isolated targets, sign in, and verify an uploaded asset's thumbnail, preview, and original download before promotion. Do not restore files by writing absolute paths into the database; the existing relative `storageKey` values must remain unchanged.
