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

## Beta 4 additions

- `GET /v1/capabilities` (bearer): reports `agent_worker`, `runtime`, `telegram`, `zip_import` configuration. Availability does not assert successful runtime execution.
- `GET /v1/data/steps|changes|validations?jobId=<uuid>` (bearer/RLS): owned job details.
- `GET /v1/data/telegram` and `telegramEvents` (bearer/RLS): metadata/delivery states only, never token/ciphertext/webhook secret.
- `POST /v1/operations/connectTelegram`: `{token, allowedUserId: "numeric-id"}`; validates real `getMe`, max five bots/account, creates an owned conversation with PREFER_FREE and AES-GCM server credentials.
- `testTelegram`, `disableTelegram`, `disconnectTelegram`: `{id}`. Disconnection deletes binding/credentials/inbox, retains conversation history.
- `enableTelegram`: `{id, confirmReplaceWebhook: true}`; explicitly replaces previous bot webhook; requires HTTPS `PUBLIC_API_ORIGIN`.
- `POST /api/public/telegram/:id`: Telegram webhook with `X-Telegram-Bot-Api-Secret-Token`; verifies constant-time secret hash and configured private sender, deduplicates update IDs and queues PostgreSQL work. No repository writes/tools. Invalid secret 401; unknown/disabled bot 404; disallowed sender/type ignored with 200; pending queue cap 429.
- `POST /v1/operations/importProjectZip`: `{name, archiveBase64, confirmUpload:true}`; max 3MiB compressed/200 entries/8MiB declared unpacked, shared archive and project ingestion logic, private storage, detected secrets rejected. No code execution. Failed ingestion returns explicit error and marks project failed.

Telegram delivery states: QUEUED → PROCESSING → READY → SENDING → SENT. Interrupted generation is INTERRUPTED; an expired/ambiguous send is SEND_UNCERTAIN and is never blindly resent. Failures are FAILED. Lease tokens fence stale workers. Shared AI routing is bounded and respects provider kill switches; PREFER_FREE can fall back to paid models.

## Beta 5 / API 0.6
- `GET /v1/agent/profiles`: canonical roles, depth pipelines and actual worker environment state; bearer required.
- `GET /v1/data/uploads`: owner RLS metadata only, no persistent signed URLs.
- `POST /v1/operations/prepareUpload`: `{name,mime,size,purpose:"FILE"|"VISION",confirmUpload:true}`. Returns an owner/path-scoped `signedUrl` and `id`. PUT raw bytes to this Supabase URL with matching Content-Type and `x-upsert:false`, without forwarding API bearer credentials. URL expires after two hours. Originals: 50MiB; vision JPEG/PNG/WebP previews: 1MiB. Non-supported MIME may be stored as octet-stream, never executed.
- `POST /v1/operations/finalizeUpload`: `{id}`. Verifies storage-reported size/MIME and vision file signature before marking READY. Failures remain PENDING; never claim successful analysis from an upload alone.
- `POST /v1/operations/removeUpload`: `{id}`. Owner check; deletion is blocked with `UPLOAD_URL_STILL_ACTIVE` for the first two hours to prevent an outstanding upload URL recreating untracked objects.
- `POST /v1/chat`: optional `imageIds:uuid[]` (at most four) with a new text question. Only owned READY VISION previews are accepted, server-minted 10-minute private URLs reach the provider, and routing requires vision support (declared or inferred). The latest user message retains attachment IDs for regeneration. Earlier image messages remain text context; this does not reread all historical images. Deleted previews produce ATTACHMENT_UNAVAILABLE.
- Atomic upload reservations charge 50MiB for PENDING records because signed upload URLs cannot enforce the client's declared size below bucket maximum. READY records charge verified actual bytes. Maximum 500MiB / 50 records per account. There is no automatic pending-object purge yet; owners can remove expired reservations.
