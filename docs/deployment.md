# Deployment and Verification

## Local Prerequisites

- Node.js compatible with Next.js 16.
- PostgreSQL reachable from the Next.js server.
- A server-writable local storage root outside the source checkout when deployed.

## First Deployment

1. Copy `.env.example` to `.env` and replace every placeholder.
2. Set `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, development seed credentials, `STORAGE_DRIVER`, `LOCAL_STORAGE_ROOT` and `MAX_UPLOAD_BYTES`.
3. Run `npm install`, `npm run db:generate`, `npm run db:migrate`, and `npm run db:seed`.
4. Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
5. Start the service with `npm run start` after a successful build.

## Test Environments

Use a database that is separate from development and production. The integration test command requires all of the following values and exits with an error if one is missing:

```dotenv
TEST_DATABASE_URL="postgresql://.../image_library_test?schema=public"
TEST_STORAGE_ROOT="./data/test-storage"
TEST_ADMIN_EMAIL="admin@example.test"
TEST_ADMIN_PASSWORD="test-only-password"
```

Apply schema and seed data to that test database before `npm run test:integration`. Do not point `TEST_DATABASE_URL` to a shared environment.

For browser tests, start an application configured for the test database and set:

```dotenv
E2E_BASE_URL="http://127.0.0.1:3000"
E2E_ADMIN_EMAIL="admin@example.test"
E2E_ADMIN_PASSWORD="test-only-password"
```

Install Chromium once with `npx playwright install chromium`, then run `npm run e2e`.

## Backup and Recovery

Back up PostgreSQL metadata and the configured storage root as a pair. Restore to an isolated environment first, run a preview/download check through authenticated routes, then promote it. Do not restore files by writing absolute paths into the database.
