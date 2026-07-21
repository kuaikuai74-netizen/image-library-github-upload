# Enterprise Image Library

## Project Goal

Build an enterprise static-image library for managing e-commerce visual assets. The system must support channels, categories, asset groups, countries, image types, colors, SPUs, preview, bulk selection, upload, download, login, and permissions.

## Current Stage

- Complete the web application, login, database, and local file storage first.
- Do not connect to a UGREEN NAS at this stage.
- Do not add NAS-specific code, credentials, mounts, or assumptions before the NAS integration stage is approved.
- The current `index.html` is a UI prototype. Do not treat its mock data or browser-only upload/download behavior as production functionality.

## Target Stack

The repository currently has no framework, package manager, or backend. Use this stack when application development begins:

- Next.js
- TypeScript with `strict: true`
- PostgreSQL
- Prisma
- Auth.js
- Sharp
- Local filesystem storage behind `StorageService`

Do not install, initialize, or replace tooling unless the current task explicitly requires it.

## Architecture Rules

- Pages and browser code must never access a local disk or NAS directly.
- All file reads, writes, deletes, and downloads must pass through `StorageService` on the server.
- Store only `storageKey` in the database. Never store absolute filesystem paths.
- Store channel, category, SPU, SKU, asset group, asset, and asset-to-group relationships in the database.
- Every asset must have exactly one `assetGroupId` when created. Cross-group reuse requires an explicit relationship model approved in the data model.
- Login and authorization checks must be enforced in both the UI and server-side route/action layer. UI checks are not sufficient authorization.
- Never commit passwords, tokens, keys, NAS credentials, `.env` files, or real production URLs to Git.
- Keep storage implementation behind an interface so future NAS integration replaces the storage adapter, not business logic or database contracts.

## Coding Rules

- Keep TypeScript strict mode enabled.
- Do not use `any`. If an unavoidable external boundary needs it, isolate it and explain the reason in a short code comment.
- Keep components focused. Split components that combine unrelated data loading, state orchestration, and visual rendering.
- Put shared business logic in services and reusable pure helpers in utilities.
- Validate every API input at the boundary before business logic runs.
- Use a consistent error model for API responses, UI feedback, and server logs.
- Preserve original file bytes and MIME type. Thumbnails and derivatives are separate generated files.
- Do not refactor unrelated code while completing a scoped task.

## Testing Rules

After every implementation task, run the available project commands for:

```text
lint
typecheck
test
build
```

If a command is unavailable because the project has not been initialized, do not invent one or install dependencies without approval. Report it explicitly with the task result.

## Working Method

- Complete one explicit task at a time.
- Ask before proceeding when business rules are ambiguous, especially asset-group ownership, cross-channel reuse, retention, and permissions.
- After completion, list changed files and test results.
- Update `README.md`, `docs/architecture.md`, and `docs/development-plan.md` whenever a change affects setup, architecture, or delivery phases.
