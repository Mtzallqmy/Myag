# BotKeep deployment — API smoke test passed

Official references checked 2026-10-08:
- https://botkeep.cloud/docs/hosting
- https://botkeep.cloud/hosting/nodejs
- https://botkeep.cloud/docs/github

## Prepared Supabase project

Following the user's authorization to choose an accessible project, the existing project **Moatazahmedalz**, reference `ywtfvgkhrmouqxsocgdq`, was restored and configured. URL: `https://ywtfvgkhrmouqxsocgdq.supabase.co`. Six Wakeel migrations are applied; the seven existing Rateel catalog tables were preserved. RLS is enabled on all 49 public tables. The original inaccessible Wakeel project `iwzzseqztdxrrqlbazip` and its data were not copied or modified. This is an empty Wakeel deployment environment, not a transfer of old accounts/history.

A service named `wakeel-api` was created in BotKeep on 2026-10-08. On 2026-10-09 it reached **Running**, using Node.js 22.23.2, port `33914`, and HTTPS origin `https://wvcvrb.bot-keep.xyz`. All eight required environment values were saved; the supplied service-role key is stored as a hidden secret and is not recorded in this repository.

The GitHub import repeatedly paused with `Source staging was interrupted`; it was cancelled through the panel's restore operation, which left existing application files intact. Those files already included the standalone API, but their old `npm start` ran `node dist/index.js` and crashed with `MISSING_SUPABASE_URL`. The exact `services/api/package.json` from branch commit `4ce026c` was uploaded to that directory with replacement enabled. The next build/start loaded the root environment file and listened successfully on the assigned port. A successful full GitHub sync/commit match has **not** been confirmed; the file upload is the recorded deployment workaround.

## Executed verification — 2026-10-09

| Check | Actual result |
| --- | --- |
| API build and TypeScript check, local branch `4ce026c` | Passed |
| Backend tests, local branch `4ce026c` | 15 passed, 0 failed |
| Supabase project status | `ACTIVE_HEALTHY` |
| Public tables / tables with RLS, live SQL | 49 / 49 |
| HTTPS `GET /health/live` | 200, `{"status":"ok"}` |
| HTTPS `GET /health/ready`, real database query | 200, `{"status":"ready"}` |
| HTTPS protected conversations read without Authorization | 401, `UNAUTHORIZED` |
| Same protected read with an invalid test bearer token | 401, `UNAUTHORIZED` |
| BotKeep runtime | Running; corrected native environment-loader command visible in Console |

This verifies backend startup, HTTPS routing, database connectivity, and rejection of unauthenticated requests. It does not verify a real user login, AI response, proxy streaming, GitHub/MCP actions, worker restart recovery, or Android functionality. `WAKEEL_WORKER_ENABLED=false` remains configured.

## Deployment procedure

1. Sign in to BotKeep. Select a Node.js application profile and a supported Node runtime **22 or newer** from the versions shown by the panel. The docs do not fix one universal Node version.
2. In GitHub, select **Mtzallqmy/Myag**, branch `migration/android-native-botkeep`. Use the full repository checkout for building; compiled API reuses root `src/lib` source.
3. Project root: `services/api`. Install/build: `npm ci --include=dev && npm run build`. Production command: `npm start`. If the panel lacks a separate build field, use `npm ci --include=dev && npm run build && npm start` as the initial startup command; verify Console and avoid a deploy that prunes dev dependencies before compiling.
   BotKeep's initial checkout is at the repository root: use `cd services/api && npm ci --include=dev && npm run build && npm start` when no working-directory setting is available. BotKeep writes Environment into the checkout-root `.env`, rather than necessarily exporting process variables. `npm start` loads both the repository-root and API-local `.env` using Node's native loader (Node 22.9+); already exported process variables take precedence. No shell evaluation of secret values is used.
4. Populate Environment using the table below. Get both API keys from this selected project's Supabase dashboard (Settings → API Keys); the server key must belong to the same project. Do not copy credentials into GitHub or APK.
5. API listens on `0.0.0.0` and `SERVER_PORT` (falls back to PORT/3000 locally). Use the Network assigned port, not an invented port.
6. Configure HTTPS in Domains and set `PUBLIC_API_ORIGIN` to that verified origin. Do not trust forwarded Host headers for OAuth redirect construction. Android does not need CORS; CORS_ORIGINS is only for exact allowed web origins.
7. Check `GET /health/live` and `GET /health/ready`. Readiness must be 200 with a working DB; liveness alone is insufficient.
8. Queue migration/grants are already applied. Keep `WAKEEL_WORKER_ENABLED=false` for the initial smoke test. Enable it only after reviewing the restart limitation below and accepting interrupted started jobs, or completing checkpoint recovery. This schedules existing `agent_jobs`; no second task system or extra DB is created.
9. Run real authenticated/provider/GitHub/MCP scenarios before promoting deployment. Check resource usage; ZIP indexing and large projects remain bounded by original limits.

## Environment for manual publishing

| Variable | Value/source |
| --- | --- |
| `SUPABASE_URL` | `https://ywtfvgkhrmouqxsocgdq.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key from the selected project |
| `SUPABASE_SERVICE_ROLE_KEY` | Server secret key or legacy service-role key from the same project; server only |
| `PROVIDER_ENCRYPTION_KEY_V1` | Generate one secure random key, save it, and keep it unchanged |
| `PUBLIC_API_ORIGIN` | The actual HTTPS origin assigned in BotKeep Domains |
| `NODE_ENV` | `production` |
| `SERVER_PORT` | The port allocated by BotKeep; use its environment-provided value |
| `WAKEEL_WORKER_ENABLED` | `false` for the initial deployment |

The selected project has no stored Wakeel credentials yet, so a new encryption key is appropriate. To generate it in a trusted terminal, run `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`, then paste the result directly into BotKeep Environment. If old encrypted rows are later transferred, their original encryption key is required; a newly generated key cannot decrypt them. Optional runtime and CORS variables may remain empty.

No Auth user was provisioned during this deployment. Create your account through Supabase Dashboard → Authentication → Users → Add user, then use `/v1/auth/login`. Configure email delivery/confirmation before allowing public registration. No administrator role was assigned automatically. Real login/refresh still need acceptance; SQL RLS tests and successful readiness do not verify Supabase Auth HTTP login.

Private storage `project-archives` is provisioned with a 50 MiB ZIP limit and per-user folder policies. No archives were uploaded. Six internal server-only tables intentionally have RLS without client policies; the Security Advisor reports these as informational notices. Their client grants were checked and denied. See `docs/SUPABASE_DEPLOYMENT.md` for actual verification results.

## Streaming acceptance

From a trusted terminal, provide temporary `WAKEEL_API_ORIGIN`, `WAKEEL_ACCESS_TOKEN` and `WAKEEL_CONVERSATION_ID`, then run:

```sh
node services/api/scripts/probe-sse.mjs
```

It submits a test message and reports only event counts/timing; it does not log the token or message content. A healthy local HTTP stream does not prove BotKeep's HTTPS proxy behavior. Observe several deltas well before completion. A short answer may be inconclusive. No real proxy test has run yet.

If BotKeep demonstrably buffers SSE, the client must use a server-side persisted generation job and poll owner-scoped messages until COMPLETE/ERROR/CANCELLED; closing a buffered request is not a reliable cancel protocol. That fallback is a required follow-up, not implemented or claimed successful here.

## Workers and restart

Queue claims use SQL row locks / SKIP LOCKED, lease tokens and owner checks. Re-enqueueing the same job is idempotent. Queued work survives process restart. Expired RUNNING work is marked INTERRUPTED and never silently replayed; partial pipeline reconciliation/checkpoint resume remains unfinished. Do not enable production background execution until this limitation is accepted or completed. No automatic retry of pushes, approvals or MCP writes.

Shutdown stops new polling and waits for the active job for up to 15s; forced shutdown leaves durable queue state for lease recovery. Logs are structured and request bodies/credentials are excluded.

## Beta 4 upgrade

Sync `migration/android-native-botkeep` using Merge files to retain host configuration. Existing startup must install/build the API (`npm --prefix services/api ci` and `npm --prefix services/api run build`) and start it with `npm --prefix services/api start`. Verify the imported commit rather than assuming a GitHub push redeploys BotKeep.

Apply `supabase/migrations/20261010015526_wakeel_telegram_bridge.sql` to the existing Supabase database. It adds owner-readable metadata/inbox and service-only encrypted Telegram secrets plus service-only lease RPCs; it does not duplicate Supabase Auth or provider/agent systems. This migration was applied successfully to selected project ywtfvgkhrmouqxsocgdq on 2026-10-10.

Set `PUBLIC_API_ORIGIN=https://wvcvrb.bot-keep.xyz` for this installation. Preserve `PROVIDER_ENCRYPTION_KEY_V1`; Telegram reuses it and needs no new global secret variable. Connect a bot from Android with its token and your numeric Telegram user ID, then explicitly activate its webhook. A working configured AI provider is required for replies. The Telegram worker runs inside the Node process; repository agent jobs still require `WAKEEL_WORKER_ENABLED=true`. Without an isolated Runtime, project builds/tests remain UNAVAILABLE. Never execute user code in BotKeep API.

Actual deployment/build/test results and remaining acceptance gaps are recorded in docs/ANDROID_BETA_4_ACCEPTANCE.md after checks finish.

### Beta 5 upgrade
API 0.6 adds upload prepare/finalize/delete and agent profile routes. Apply `20261010172202_wakeel_media_uploads.sql` to the same Supabase project (applied during this session). No extra secret variable is needed. Keep existing encryption key and credentials. Enable `WAKEEL_WORKER_ENABLED=true` after the new server bundle is deployed; this activates the existing PostgreSQL lease worker, not an in-process user-code sandbox. Runtime stays UNAVAILABLE until an isolated runtime URL/shared secret are configured. Source imports must finish successfully before a restart; the old API returns 404 for the new routes.
