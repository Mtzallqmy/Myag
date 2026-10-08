> Native migration is in progress on `migration/android-native-botkeep`. The PWA is retained. A standalone API is under `services/api`; no Native APK is available yet. See [migration status](docs/MIGRATION_STATUS.md), [audit](docs/MIGRATION_AUDIT.md), [API contract](docs/API_CONTRACT.md) and [BotKeep setup](docs/BOTKEEP_DEPLOYMENT.md).

# Wakeel (وكيل) — AI Coding Agent Platform · Stage 1

Mobile-first, Arabic-first (RTL) installable web app for chatting with AI models from your own OpenAI-compatible providers.

## Stack
- TanStack Start (React 19 + TypeScript), Tailwind v4
- Lovable Cloud: Postgres + Auth + Realtime (RLS on every user table)
- Server functions (`src/lib/*.functions.ts`) and server routes (`src/routes/api/*`) instead of separate Edge Functions

## Lovable setup
Open the project in Lovable. Cloud is already connected; migrations live in `drizzle/migrations/` / the Cloud migration history.

## Backend pieces
| Piece | Location |
| --- | --- |
| Provider create / update / delete / test / models refresh / model test | `src/lib/providers.functions.ts` |
| Streaming chat gateway (SSE, bounded fallback) | `src/routes/api/chat.ts` |
| Token encryption (AES-256-GCM, key versions) | `src/lib/server/crypto.server.ts` |
| SSRF-safe fetch (HTTPS, DoH IP checks, redirect checks) | `src/lib/server/outbound.server.ts` |
| Provider adapters | `src/lib/server/providers.server.ts` |
| Routing logic | `src/lib/ai/routing.ts` |

## Secrets
- `PROVIDER_ENCRYPTION_KEY_V1` — master key for provider token encryption (server only). To rotate: add `PROVIDER_ENCRYPTION_KEY_V2`, bump `CURRENT_KEY_VERSION`, re-save tokens.
- Supabase URL/keys are managed by Lovable Cloud. No secret is committed.

## Local development
```sh
bun install
bun run dev
bun run test
```

## Known limitations (Stage 1)
- Custom provider headers are not supported yet.
- Offline mode works only in the published app (never in the editor preview).
- This is a PWA, not a native APK.

# Stage 2 — Projects, Agent Jobs, Approvals, GitHub, MCP

## New pages
Projects (`/projects`, `/projects/:id` with Ask, Task, Files, Search, Changes, Tests, Info, Log), Tasks (`/tasks`, `/tasks/:id`), GitHub (`/github`), Integrations & MCP (`/integrations`).

## New tables (all RLS, user-scoped)
projects, project_files, project_symbols, project_chunks, agent_jobs, agent_job_steps, approvals, change_sets, validation_runs,
github_connections, github_credentials*, github_repositories, repository_workspaces, mcp_servers, mcp_credentials*, mcp_oauth_states*,
mcp_tools, mcp_resources, mcp_prompts, integration_registry. (*service-role only, encrypted)

Storage: private bucket `project-archives`, objects scoped to `<user_id>/…`.

## Server functions
| Area | File |
| --- | --- |
| Projects, search, file read, grounded Q&A | `src/lib/projects.functions.ts` |
| Agent jobs, approvals, git push / PR | `src/lib/agent.functions.ts` |
| GitHub connect / repos / issues / import | `src/lib/github.functions.ts` |
| MCP servers / OAuth / tools | `src/lib/mcp.functions.ts` |
| MCP OAuth callback | `src/routes/api/public/mcp-oauth/callback.ts` |

## GitHub setup
Uses a fine-grained Personal Access Token (encrypted server-side). Permissions: Contents RW, Pull requests RW, Issues R, Metadata R.
The agent only writes to `agent/<slug>-<id>` branches, never force-pushes, and each push/PR needs an approval.
A GitHub App can replace the PAT later (store App ID / private key as server secrets).

## MCP setup
Add a Streamable HTTP server URL in Integrations. OAuth servers: click "Authorize" (PKCE + state, issuer validated, tokens encrypted).
Tools default: LOW enabled; MEDIUM/HIGH disabled + approval; CRITICAL disabled and needs explicit confirmation.

## Runtime adapter
See `docs/RUNTIME_CONTRACT.md`. Optional secrets: `AGENT_RUNTIME_BASE_URL`, `AGENT_RUNTIME_SHARED_SECRET`.
