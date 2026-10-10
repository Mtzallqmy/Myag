# Wakeel migration audit

Baseline: `7f16619` (main), reviewed 2026-10-08. This document records source evidence, not live acceptance.

## Findings
- The repository is a TanStack Start PWA. The existing Android workflow generates a Capacitor WebView shell; it does not meet Native Android requirements.
- Missing `src/assets/logo-mark.png` imports in landing/auth/AppShell break module resolution. Replaced with a local SVG mark.
- Business logic exists for providers, routing, projects, approvals, GitHub PAT and MCP OAuth, staff roles, memory and quotas. Roadmap completion checkboxes are not evidence of live tests.
- `runAgentJob` is invoked by the browser after creation. It has a read-then-start race, no worker lease, no durable resume checkpoints. Migration requires server scheduling and transactional claims.
- Applying patches marks a job COMPLETED even when runtime validation is UNAVAILABLE/FAILED, and runtime workspace setup/sync is missing. Must separate applied from verified.
- Most database writes ignore errors. End-to-end success cannot be asserted before checking persisted effects.
- `supabase/config.toml` identifies existing project `iwzzseqztdxrrqlbazip`. Neither connected Supabase account lists this project. No other project's DB will be modified.
- No lockfile at baseline. npm lockfiles now exist; 71 original tests and production build passed.
- Runtime is only an HMAC adapter; no isolated execution service is deployed here.
- Existing GitHub integration uses a fine-grained PAT, not OAuth account linking.
- No signing keys, device/emulator or BotKeep deployment credentials are in the checkout.

## Feature inventory

| Feature | Original | Destination | Migration state | Verification |
|---|---|---|---|---|
| Auth/session | `src/integrations/supabase/` | Native session + bearer API | Pending | Login, refresh, logout, revoked token |
| Chat/history/regeneration/cancel | `src/routes/api/chat.ts`, `queries.ts`, chats routes | HTTP SSE + Compose chat | Pending | Actual provider reply, incremental bytes, cancellation, 401/429/5xx |
| Routing | `src/lib/ai/routing.ts` | Reused server module | Pending | Existing bounded fallback unit tests + provider E2E |
| ZIP/scanner/symbols | `projects/archive.ts`, `server/ingest.server.ts` | Server ingest + Native picker | Pending | Traversal/bomb/size rejection, persisted files |
| File/search/diffs/tests | `queries2.ts`, project/task routes | RLS API + Compose project/task | Pending | Ownership, lines, search, diff, truthful validation |
| Notifications/history/settings | `queries3.ts`, routes | Native screens + local settings | Pending | Session-scoped storage, offline/reconnect |
| Jobs/restart/leases | `agent.functions.ts`, agent tables | PostgreSQL worker | Missing at baseline | Restart, fencing, duplicate delivery, cancellation |
| Runtime isolation | `server/runtime.server.ts` | External adapter retained | External unavailable | Configure isolated runtime; no fake pass |
| createAgentJob | `src/lib/agent.functions.ts` | `POST /v1/operations/createAgentJob` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| runAgentJob | `src/lib/agent.functions.ts` | `POST /v1/operations/runAgentJob` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| cancelAgentJob | `src/lib/agent.functions.ts` | `POST /v1/operations/cancelAgentJob` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| requestGitAction | `src/lib/agent.functions.ts` | `POST /v1/operations/requestGitAction` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| decideApproval | `src/lib/agent.functions.ts` | `POST /v1/operations/decideApproval` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| getRuntimeStatus | `src/lib/agent.functions.ts` | `GET /v1/operations/getRuntimeStatus` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| addMcpServer | `src/lib/mcp.functions.ts` | `POST /v1/operations/addMcpServer` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| refreshMcpServer | `src/lib/mcp.functions.ts` | `POST /v1/operations/refreshMcpServer` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| startMcpOAuth | `src/lib/mcp.functions.ts` | `POST /v1/operations/startMcpOAuth` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| setMcpToolState | `src/lib/mcp.functions.ts` | `POST /v1/operations/setMcpToolState` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| callMcpTool | `src/lib/mcp.functions.ts` | `POST /v1/operations/callMcpTool` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| createProvider | `src/lib/providers.functions.ts` | `POST /v1/operations/createProvider` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| updateProvider | `src/lib/providers.functions.ts` | `POST /v1/operations/updateProvider` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| deleteProvider | `src/lib/providers.functions.ts` | `POST /v1/operations/deleteProvider` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| testProvider | `src/lib/providers.functions.ts` | `POST /v1/operations/testProvider` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| testModel | `src/lib/providers.functions.ts` | `POST /v1/operations/testModel` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| getMyAccess | `src/lib/stage3.functions.ts` | `GET /v1/operations/getMyAccess` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| claimFirstAdmin | `src/lib/stage3.functions.ts` | `POST /v1/operations/claimFirstAdmin` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| addMemory | `src/lib/stage3.functions.ts` | `POST /v1/operations/addMemory` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| globalSearch | `src/lib/stage3.functions.ts` | `POST /v1/operations/globalSearch` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| getUsage | `src/lib/stage3.functions.ts` | `POST /v1/operations/getUsage` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| adminOverview | `src/lib/stage3.functions.ts` | `GET /v1/operations/adminOverview` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| adminList | `src/lib/stage3.functions.ts` | `POST /v1/operations/adminList` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| adminAudit | `src/lib/stage3.functions.ts` | `POST /v1/operations/adminAudit` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| adminFlags | `src/lib/stage3.functions.ts` | `GET /v1/operations/adminFlags` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| adminSetFlag | `src/lib/stage3.functions.ts` | `POST /v1/operations/adminSetFlag` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| adminSetKillSwitch | `src/lib/stage3.functions.ts` | `POST /v1/operations/adminSetKillSwitch` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| adminSetPlan | `src/lib/stage3.functions.ts` | `POST /v1/operations/adminSetPlan` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| adminSetRole | `src/lib/stage3.functions.ts` | `POST /v1/operations/adminSetRole` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| adminHealth | `src/lib/stage3.functions.ts` | `GET /v1/operations/adminHealth` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| createProject | `src/lib/projects.functions.ts` | `POST /v1/operations/createProject` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| ingestProjectBatch | `src/lib/projects.functions.ts` | `POST /v1/operations/ingestProjectBatch` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| finalizeProjectIngest | `src/lib/projects.functions.ts` | `POST /v1/operations/finalizeProjectIngest` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| searchProject | `src/lib/projects.functions.ts` | `POST /v1/operations/searchProject` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| readFile | `src/lib/projects.functions.ts` | `POST /v1/operations/readFile` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| askProject | `src/lib/projects.functions.ts` | `POST /v1/operations/askProject` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| connectGithub | `src/lib/github.functions.ts` | `POST /v1/operations/connectGithub` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| refreshGithub | `src/lib/github.functions.ts` | `POST /v1/operations/refreshGithub` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| disconnectGithub | `src/lib/github.functions.ts` | `POST /v1/operations/disconnectGithub` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| listRepoItems | `src/lib/github.functions.ts` | `POST /v1/operations/listRepoItems` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |
| importRepository | `src/lib/github.functions.ts` | `POST /v1/operations/importRepository` | HTTP transport extracted; live acceptance pending | Auth, validator, ownership/RBAC, real external integration |

## Gates
1. Audit/contracts committed and pushed before backend work.
2. Backend build, auth/ownership tests and existing regression tests run before declaring phase 2 complete.
3. Native compilation and UI tests before declaring phase 3 complete.
4. Live DB/provider/GitHub/MCP acceptance and restart/network tests before completion.
5. Actual BotKeep HTTPS SSE/proxy check and ARM64 device acceptance before beta release.

Keep the legacy PWA until all inventory rows have evidence of equivalent behavior.

## Native tester beta supplement — 2026-10-10

The user explicitly requested a tester APK before device/performance acceptance and will perform that testing. Full migration gates above remain required for declaring parity/production completion. This early beta reuses the existing API and does not remove the web version.

| Web feature | Native implementation | Beta status | Verification boundary |
| --- | --- | --- | --- |
| Auth/session | core/SessionStore, data/WakeelRepository, feature/WakeelViewModel | Login/refresh/logout + Supabase signup, Keystore encryption | Build/lint; live user acceptance pending |
| Chat/history/regenerate/cancel | MainActivity Chat/Message, repository SSE, core/Sse | Native UI + existing /v1/chat | Parser unit tests; real provider/proxy/device pending |
| Provider CRUD/discovery/model test | MainActivity Providers/ProviderForm + existing operations | Implemented UI; secrets server-only | Build/lint; external provider acceptance pending |
| Routing/model selection | Existing routing.ts + native newConversation | Auto/manual at creation | Editing an existing conversation's routing not migrated |
| Projects/files/search/Ask Project | MainActivity Project + readFile/searchProject/askProject | Empty project create and reading/search | ZIP/GitHub import and advanced diff UI pending |
| Agent/jobs | MainActivity Collection jobs | Read-only monitoring | Execution/recovery UI pending; server worker disabled |
| Approvals | MainActivity Collection approvals + decideApproval | Explicit review and approve/reject | Live persisted approval acceptance pending |
| GitHub/MCP | Owner-scoped collection read | Account/server lists only | OAuth/connect/tools/commit/push/PR UI pending |
| Memory/notifications/history | Owner-scoped collection read | Read-only | Editing, push notification integration pending |
| Admin/plans/quotas/flags | Existing server operations retained | Native admin UI not implemented | Server RBAC remains authoritative |
| RTL/theme/settings/offline cache | Compose/Navigation, Room, DataStore | Implemented | Device accessibility/reconnection/performance pending |

Native sources are under apps/android/app/src/main/java/com/wakeel/app/. Markwon uses native TextView for Markdown; no WebView, Flutter, React Native or Capacitor executes the main UI.

## Beta 4 delta (2026-10-10)

The baseline table above describes initial extraction. This delta records the current native implementation; it does not mark full migration complete.

| Feature | Reused original | New native/backend implementation | Status and executed verification |
|---|---|---|---|
| Local file recognition/processing | Room file cache/LocalSearch from Beta 3 | core/FileInspector, feature/Enhancements.LocalWorkspace, data/WakeelRepository | Native implementation built; 3 file-inspection + 2 search tests passed; SAF/UI/device acceptance pending |
| Model filtering/prices | src/lib/ai/models.ts, routing.ts, provider discovery | core/ModelCatalog, ModelBrowser, shared price normalization fix | Native catalog test + backend normalization test passed; actual provider discovery/reply pending |
| Chat/code/attachments/transitions | Existing SSE session/repository/Markwon | MainActivity.Chat/Message, LocalWorkspace attachment review | Compiled/Lint passed, parser tests passed; real stream/device/UI acceptance pending |
| ZIP project import | projects/archive.ts, operations/projects.server.ts, private archives/chunks | services/api/src/zip-import.ts, ZipImport + explicit SAF upload | Three ZIP integration tests passed (real bytes/bounds/traversal/symlink/bomb); live persisted import pending deployment |
| Agent scheduling/progress/diffs | Existing agent/policy/roles/runtime/queue/approvals | TaskControls, TaskDetail, capabilities + owned step/change/validation reads | Native implementation built and queue tests passed; worker deployment/real jobs/runtime acceptance pending; started steps interrupt safely rather than checkpoint resume |
| Telegram bridge | Existing AES-GCM, provider gateway, quota/kill switches/conversations | telegram.ts + PostgreSQL metadata/secrets/inbox lease RPCs, TelegramScreen | Four policy/adapter/SQL/RLS tests passed. Live migration applied and grants checked; actual bot/model delivery pending |

Android build/test/Lint/signing/manifest/ARM64 checks passed for source 05796afb16909f88bc8b8322accc2330995dbfa0. Details and deployment evidence: ANDROID_BETA_4_ACCEPTANCE.md. Legacy web source remains present. GitHub/MCP OAuth, full admin UX, original-history transfer, isolated runtime, complete checkpoint resume and device acceptance remain outstanding.

### Beta 5 additions (2026-10-10)
| Feature | Original/shared implementation | Native/API replacement | Verification |
|---|---|---|---|
| Model tests / full listing | providers operations, ai_models | Correct modelId; paged model list up to 3000 | API input validation; Android CI pending at source preparation |
| Agent identity / connections | agent/roles.ts, existing queue | authenticated profiles API and uncached live diagnostics | API profiles/pipelines test executed |
| Local image/video/PDF | new native support | MediaInspector platform decoders, SHA-256 streaming, Room metadata, persisted SAF access | compile/lint CI pending; device decoding not yet tested |
| Private original uploads | new user attachments, separate from project chunks | Supabase bucket + owner RLS + scoped signed PUT, cancellation/progress | migration applied; quota/RLS/validators tested; signed upload live acceptance pending |
| Vision chat | existing shared OpenAI-compatible gateway/routing | owned preview IDs, private URLs, vision capability gate, SSE | adapter/type checks; real provider response pending normal authenticated session |
| Routing security | selectCandidates | preferred/manual selection must belong to usable models/providers | explicit disabled-provider/failed-model regression passed |

Full video/audio transcription, full PDF text extraction, arbitrary local model execution, GitHub/MCP native feature parity and real runtime acceptance remain incomplete. Preview-based analysis is explicitly labelled; there are no simulated completions.
