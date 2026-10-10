# Migration status — 2026-10-10 (Asia/Aden)

This is an intermediate migration. The user authorized an early native tester beta before device/performance acceptance; this does not waive full feature-parity or production gates. Native build results and release provenance are recorded in ANDROID_BETA_ACCEPTANCE.md.

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
- Full Android feature parity. The native Kotlin/Compose beta and native CI now exist under apps/android; see apps/android/BETA_NOTES.md for the exact implemented subset and remaining screens. Phase 3 is partial, not complete.
- BotKeep HTTPS proxy streaming verification with a real provider and any fallback for demonstrated buffering. Basic API deployment and real DB readiness are verified; see BOTKEEP_DEPLOYMENT.md.
- Isolated runtime deployment/cleanup and validated workspace import for EMPTY projects.
- ARM64 device/performance tests and production signing remain outstanding. The native beta pipeline builds and checks an installable test-signed APK separately from the retained legacy Capacitor workflow; exact executed results are recorded in ANDROID_BETA_ACCEPTANCE.md.

## Concrete blockers / next gate
- Supabase config now targets `ywtfvgkhrmouqxsocgdq` after the user's accessible-project authorization. Selected DB is ACTIVE_HEALTHY and configured. The original `iwzzseqztdxrrqlbazip` remains inaccessible. Other connected projects were not modified.
- BotKeep API is Running at https://wvcvrb.bot-keep.xyz/ with all eight configured environment values. HTTPS liveness/readiness returned 200 and invalid/missing bearer requests returned 401. Real login/provider/GitHub/MCP workflows remain acceptance work.
- Empty selected environment may use a new securely generated encryption key. Transferring original encrypted credentials later requires their original key.

No new Supabase project was created. Six application migrations were applied to the user-authorized existing project. No main-branch mutation or force push. Web source/history remain intact; the native tester beta is explicitly incomplete.

## Beta 4 update

Source 05796afb16909f88bc8b8322accc2330995dbfa0 adds local file inspection/processing/export, catalog filters, chat code/attachment/transition improvements, small ZIP import, native agent controls/details and secure read/chat Telegram bridge. Supabase Telegram migration applied to the existing selected project. CI passed 11 native unit tests, Lint and APK verification; local and CI backend suites passed 23 tests; legacy 71 tests/build remained passing.

This is a published tester beta, not complete legacy feature parity. Full started-step recovery, GitHub/MCP native integration workflows, admin parity, isolated project execution and physical-device acceptance remain pending. BotKeep deployment and artifact identity are recorded in ANDROID_BETA_4_ACCEPTANCE.md.

## Beta 5 work
API 0.6 and native media/diagnostic improvements are prepared. Supabase private attachment migration applied. API 27 tests / legacy 71 tests executed successfully locally; Android build and live deployment acceptance pending. See ANDROID_BETA_5_ACCEPTANCE.md for precise limits and verification updates.
