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
- No lockfile at baseline. Dependency installation and web verification are in progress.
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
| createAgentJob | `src/lib/agent.functions.ts` | `POST /v1/operations/createAgentJob` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| runAgentJob | `src/lib/agent.functions.ts` | `POST /v1/operations/runAgentJob` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| cancelAgentJob | `src/lib/agent.functions.ts` | `POST /v1/operations/cancelAgentJob` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| requestGitAction | `src/lib/agent.functions.ts` | `POST /v1/operations/requestGitAction` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| decideApproval | `src/lib/agent.functions.ts` | `POST /v1/operations/decideApproval` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| getRuntimeStatus | `src/lib/agent.functions.ts` | `GET /v1/operations/getRuntimeStatus` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| addMcpServer | `src/lib/mcp.functions.ts` | `POST /v1/operations/addMcpServer` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| refreshMcpServer | `src/lib/mcp.functions.ts` | `POST /v1/operations/refreshMcpServer` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| startMcpOAuth | `src/lib/mcp.functions.ts` | `POST /v1/operations/startMcpOAuth` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| setMcpToolState | `src/lib/mcp.functions.ts` | `POST /v1/operations/setMcpToolState` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| callMcpTool | `src/lib/mcp.functions.ts` | `POST /v1/operations/callMcpTool` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| createProvider | `src/lib/providers.functions.ts` | `POST /v1/operations/createProvider` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| updateProvider | `src/lib/providers.functions.ts` | `POST /v1/operations/updateProvider` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| deleteProvider | `src/lib/providers.functions.ts` | `POST /v1/operations/deleteProvider` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| testProvider | `src/lib/providers.functions.ts` | `POST /v1/operations/testProvider` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| testModel | `src/lib/providers.functions.ts` | `POST /v1/operations/testModel` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| getMyAccess | `src/lib/stage3.functions.ts` | `GET /v1/operations/getMyAccess` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| claimFirstAdmin | `src/lib/stage3.functions.ts` | `POST /v1/operations/claimFirstAdmin` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| addMemory | `src/lib/stage3.functions.ts` | `POST /v1/operations/addMemory` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| globalSearch | `src/lib/stage3.functions.ts` | `POST /v1/operations/globalSearch` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| getUsage | `src/lib/stage3.functions.ts` | `POST /v1/operations/getUsage` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| adminOverview | `src/lib/stage3.functions.ts` | `GET /v1/operations/adminOverview` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| adminList | `src/lib/stage3.functions.ts` | `POST /v1/operations/adminList` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| adminAudit | `src/lib/stage3.functions.ts` | `POST /v1/operations/adminAudit` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| adminFlags | `src/lib/stage3.functions.ts` | `GET /v1/operations/adminFlags` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| adminSetFlag | `src/lib/stage3.functions.ts` | `POST /v1/operations/adminSetFlag` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| adminSetKillSwitch | `src/lib/stage3.functions.ts` | `POST /v1/operations/adminSetKillSwitch` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| adminSetPlan | `src/lib/stage3.functions.ts` | `POST /v1/operations/adminSetPlan` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| adminSetRole | `src/lib/stage3.functions.ts` | `POST /v1/operations/adminSetRole` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| adminHealth | `src/lib/stage3.functions.ts` | `GET /v1/operations/adminHealth` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| createProject | `src/lib/projects.functions.ts` | `POST /v1/operations/createProject` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| ingestProjectBatch | `src/lib/projects.functions.ts` | `POST /v1/operations/ingestProjectBatch` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| finalizeProjectIngest | `src/lib/projects.functions.ts` | `POST /v1/operations/finalizeProjectIngest` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| searchProject | `src/lib/projects.functions.ts` | `POST /v1/operations/searchProject` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| readFile | `src/lib/projects.functions.ts` | `POST /v1/operations/readFile` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| askProject | `src/lib/projects.functions.ts` | `POST /v1/operations/askProject` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| connectGithub | `src/lib/github.functions.ts` | `POST /v1/operations/connectGithub` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| refreshGithub | `src/lib/github.functions.ts` | `POST /v1/operations/refreshGithub` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| disconnectGithub | `src/lib/github.functions.ts` | `POST /v1/operations/disconnectGithub` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| listRepoItems | `src/lib/github.functions.ts` | `POST /v1/operations/listRepoItems` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |
| importRepository | `src/lib/github.functions.ts` | `POST /v1/operations/importRepository` | Existing code; migration pending | Auth, validator, ownership/RBAC, real external integration |

## Gates
1. Audit/contracts committed and pushed before backend work.
2. Backend build, auth/ownership tests and existing regression tests run before declaring phase 2 complete.
3. Native compilation and UI tests before declaring phase 3 complete.
4. Live DB/provider/GitHub/MCP acceptance and restart/network tests before completion.
5. Actual BotKeep HTTPS SSE/proxy check and ARM64 device acceptance before beta release.

Keep the legacy PWA until all inventory rows have evidence of equivalent behavior.
