# BotKeep deployment — prepared, not deployed

Official references checked 2026-10-08:
- https://botkeep.cloud/docs/hosting
- https://botkeep.cloud/hosting/nodejs
- https://botkeep.cloud/docs/github

## Required existing account/project

Keep the existing Supabase project `iwzzseqztdxrrqlbazip` and its encryption key. Neither currently connected Supabase account exposes it. No migration has been applied remotely. The BotKeep control panel redirects the available browser to sign-in; no service has been created.

## Deployment procedure

1. Sign in to BotKeep. Select a Node.js application profile and a supported Node runtime **22 or newer** from the versions shown by the panel. The docs do not fix one universal Node version.
2. In GitHub, select **Mtzallqmy/Myag**, branch `migration/android-native-botkeep`. Use the full repository checkout for building; compiled API reuses root `src/lib` source.
3. Project root: `services/api`. Install/build: `npm ci --include=dev && npm run build`. Production command: `npm start`. If the panel lacks a separate build field, use `npm ci --include=dev && npm run build && npm start` as the initial startup command; verify Console and avoid a deploy that prunes dev dependencies before compiling.
4. Populate Environment from `services/api/.env.example`. Use current Supabase URL, publishable key, server key and **unchanged** `PROVIDER_ENCRYPTION_KEY_V1`. Do not copy credentials into GitHub or APK.
5. API listens on `0.0.0.0` and `SERVER_PORT` (falls back to PORT/3000 locally). Use the Network assigned port, not an invented port.
6. Configure HTTPS in Domains and set `PUBLIC_API_ORIGIN` to that verified origin. Do not trust forwarded Host headers for OAuth redirect construction. Android does not need CORS; CORS_ORIGINS is only for exact allowed web origins.
7. Check `GET /health/live` and `GET /health/ready`. Readiness must be 200 with a working DB; liveness alone is insufficient.
8. After reviewing/applying the new queue migration to the existing DB and verifying grants/RLS, set `WAKEEL_WORKER_ENABLED=true`. This schedules existing `agent_jobs`; no second task system or extra DB is created.
9. Run real authenticated/provider/GitHub/MCP scenarios before promoting deployment. Check resource usage; ZIP indexing and large projects remain bounded by original limits.

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
