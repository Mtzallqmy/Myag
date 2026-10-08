# Wakeel HTTP API contract (migration target)

Version `/v1`. Every protected request requires `Authorization: Bearer <Supabase access token>`; server verifies token with Supabase Auth and uses a caller-scoped client for ownership checks. No service role key is sent to Android. POST bodies are plain JSON (not TanStack envelopes).

- `GET /health/live`: process liveness, no secrets.
- `GET /health/ready`: DB/config readiness; 503 if unavailable.
- `POST /v1/operations/<name>`: source operation input validators and result envelopes preserved. GET operations accept no body. See audit inventory.
- `POST /v1/chat`: `{conversationId,content?,retry?}`. SSE events `start`, `model`, `fallback`, `delta`, `done`, `error`. Closing the HTTP request cancels upstream and persists CANCELLED.
- `GET /v1/data/<collection>`: allowlisted caller-scoped, bounded reads; no arbitrary table/column query.
- `POST /v1/conversations`: create caller-owned conversation.
- `POST /v1/jobs`: durable enqueue; idempotency key required. Disconnect must not cancel work.
- `GET /v1/jobs/<id>`: job, steps, approvals, changes, validation; owner-only.
- `GET /api/public/mcp-oauth/callback`: PKCE state exchange server-side; native uses system browser.

Errors: `{ok:false,error:<stable code>}`; 400 validation, 401 auth, 403 permission, 404 owner-scoped absence, 409 conflict, 429 quota/rate limit, 503 unavailable. Internal exceptions and credentials never returned.

Native Auth uses Supabase Auth password/refresh/logout endpoints with the existing project publishable key. Sessions are encrypted with Android Keystore. No provider keys in BuildConfig.

Deployment must verify incremental SSE through the real HTTPS proxy; headers alone do not prove proxy behavior. Polling persisted assistant messages is the documented fallback if streaming is buffered.
