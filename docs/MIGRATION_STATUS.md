# Migration status — 2026-10-08

This is an intermediate implementation, not a completed migration or beta release.

## Implemented
- Audit, original feature inventory and API contract pushed on independent branch.
- Missing logo imports repaired; legacy web app retained.
- All 41 existing server operations extracted into transport-independent modules. Legacy TanStack wrappers and standalone Fastify API share their validators, guards, encryption, routing and business implementation.
- Standalone service, lockfile, TypeScript build, bearer authentication, RLS-scoped allowlisted reads, conversation creation, auth login/refresh/logout, SSE bridge/cancellation, MCP callback, rate limiting, safe error responses, structured logs, health checks, graceful shutdown, BotKeep environment/runbook.
- Job scheduling on existing Supabase/PostgreSQL via a reviewed migration with service-only queue/RPCs, leases and idempotent enqueue. Worker is disabled by default. Atomic pipeline claim prevents duplicate start.
- Applied changes are reported APPLIED_UNVERIFIED when runtime absent and VALIDATION_FAILED when validation fails. Runtime setup/sync sends actual project files before validation.

## Executed validation
- Original Vitest suite: 71 tests passed.
- Original web production build: passed after repair and after extraction.
- Root TypeScript checking: passed after preserving GhItem export.
- Standalone API build and TypeScript checking: passed.
- HTTP/API tests + embedded PostgreSQL queue tests: 14 tests passed; no live Supabase acceptance implied.
- Queue SQL executed against embedded PostgreSQL (PGlite) fixtures: enqueue ownership/idempotency, single claim, stale lease rejection, interrupted recovery, anon/authenticated denied.

## Not completed
- Automatic resumable checkpoints/reconciliation for already-started jobs. Conservative INTERRUPTED status avoids unsafe replay.
- Full HTTP contract: native ZIP upload, routing edits, notification/memory writes and job aggregate endpoints still need completion; original operations are exposed and originals retained.
- Live original Supabase access/migration/grants/advisors, actual provider replies and Supabase login/refresh, GitHub/MCP OAuth acceptance.
- Android Native app and Native CI. Sequential phase 2 acceptance is still incomplete; phase 3 has not been declared started/completed.
- BotKeep deployment, HTTPS proxy streaming verification and any fallback for demonstrated buffering.
- Isolated runtime deployment/cleanup and validated workspace import for EMPTY projects.
- ARM64 device tests, signed APK, beta release. None exists; existing Capacitor workflow remains legacy reference and must not be presented as native output.

## Concrete blockers / next gate
- Supabase config targets `iwzzseqztdxrrqlbazip`; connected accounts expose only other projects. Connect the owning account/project or configure that project's existing secrets in BotKeep Environment.
- BotKeep browser is at sign-in. A signed-in control panel is required for actual deployment.
- Keep the existing provider encryption key. Without it encrypted stored credentials cannot be migrated by substituting a new key.

No replacement DB was created. No main-branch mutation, force push, deployment claim, or APK claim.
