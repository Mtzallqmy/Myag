# Migration status — 2026-10-08

This is an intermediate implementation, not a completed migration or beta release.

## Implemented
- Audit, original feature inventory and API contract pushed on independent branch.
- Missing logo imports repaired; legacy web app retained.
- All 41 existing server operations extracted into transport-independent modules. Legacy TanStack wrappers and standalone Fastify API share their validators, guards, encryption, routing and business implementation.
- Standalone service, lockfile, TypeScript build, bearer authentication, RLS-scoped allowlisted reads, conversation creation, auth login/refresh/logout, SSE bridge/cancellation, MCP callback, rate limiting, safe error responses, structured logs, health checks, graceful shutdown, BotKeep environment/runbook.
- Job scheduling on existing Supabase/PostgreSQL via a reviewed migration with service-only queue/RPCs, leases and idempotent enqueue. Worker is disabled by default. Atomic pipeline claim prevents duplicate start.
- Applied changes are reported APPLIED_UNVERIFIED when runtime absent and VALIDATION_FAILED when validation fails. Runtime setup/sync sends actual project files before validation.
- User-authorized accessible Supabase deployment configured in existing `Moatazahmedalz` project (`ywtfvgkhrmouqxsocgdq`): six remote migrations, 42 Wakeel tables, private ZIP bucket, Realtime publications and server-only grants. Seven existing catalog tables preserved. Original inaccessible Wakeel data was not copied.

## Executed validation
- Original Vitest suite: 71 tests passed.
- Original web production build: passed after repair and after extraction.
- CI initially exposed an optional Ajv peer conflict and shared-source dependency resolution hidden by local root packages. Ajv 8 is now explicitly pinned for the existing form resolver, and API TypeScript resolves shared imports from its own dependencies while keeping them external in the JavaScript bundle.
- Root TypeScript checking: passed after preserving GhItem export.
- Standalone API build and TypeScript checking: passed, including a clean service-only installation with no root node_modules.
- HTTP/API tests + embedded PostgreSQL tests: 15 tests passed; no live Supabase acceptance implied.
- All six original/queue/storage migrations also executed together on a fresh embedded PostgreSQL schema: 42 tables, all with RLS enabled. User bootstrap, cross-user conversation isolation, forged ownership rejection, private bucket configuration, and denial of client access to internal tables passed, including simulated default client grants. Supabase system objects are local fixtures in this test.
- Queue SQL executed against embedded PostgreSQL (PGlite) fixtures: enqueue ownership/idempotency, single claim, stale lease rejection, interrupted recovery, anon/authenticated denied.
- Live Supabase SQL acceptance passed: user bootstrap, owner read, cross-user isolation, forged ownership rejection, internal table/worker RPC denial. Transaction rolled back; no test users/conversations persisted. All 49 public tables have RLS. Security Advisor reported only six informational notices for intentionally server-only tables without client policies. See `SUPABASE_DEPLOYMENT.md`.

## Not completed
- Automatic resumable checkpoints/reconciliation for already-started jobs. Conservative INTERRUPTED status avoids unsafe replay.
- Full HTTP contract: native ZIP upload, routing edits, notification/memory writes and job aggregate endpoints still need completion; original operations are exposed and originals retained.
- Original Supabase data transfer, actual provider replies and Supabase Auth HTTP login/refresh, GitHub/MCP OAuth acceptance. Selected live DB schema/grants/advisors are verified, but this does not imply published API acceptance.
- Android Native app and Native CI. Sequential phase 2 acceptance is still incomplete; phase 3 has not been declared started/completed.
- BotKeep deployment, HTTPS proxy streaming verification and any fallback for demonstrated buffering.
- Isolated runtime deployment/cleanup and validated workspace import for EMPTY projects.
- ARM64 device tests, signed APK, beta release. None exists; existing Capacitor workflow remains legacy reference and must not be presented as native output.

## Concrete blockers / next gate
- Supabase config now targets `ywtfvgkhrmouqxsocgdq` after the user's accessible-project authorization. Selected DB is ACTIVE_HEALTHY and configured. The original `iwzzseqztdxrrqlbazip` remains inaccessible. Other connected projects were not modified.
- User will manually publish the API to BotKeep using `BOTKEEP_DEPLOYMENT.md`. Server keys and HTTPS origin must be configured there before real API acceptance. No BotKeep deployment exists yet.
- Empty selected environment may use a new securely generated encryption key. Transferring original encrypted credentials later requires their original key.

No new Supabase project was created. Six application migrations were applied to the user-authorized existing project. No main-branch mutation, force push, BotKeep deployment claim, or APK claim.
