# Architecture

TanStack Start (React 19, SSR on Cloudflare Workers) + Lovable Cloud (Postgres, Auth, Storage, Realtime).

```text
Browser (PWA, Arabic RTL / English)
  ├─ RLS-scoped reads  → queries.ts / queries2.ts / queries3.ts
  ├─ server functions  → providers / projects / agent / github / mcp / stage3 .functions.ts
  └─ SSE chat          → /api/chat (bearer-verified)
Server
  ├─ guards.server.ts  → kill switches, flags, quotas, notifications, app_events
  ├─ llm.server.ts     → routing (selectCandidates) + bounded fallback
  ├─ agent pipeline    → roles.ts (FAST/BALANCED/DEEP/MULTI), MAX_JOB_STEPS
  └─ outbound.server   → safeFetch for every user-supplied URL
External: AI providers, GitHub, MCP servers, optional isolated runtime
```

## Routes
`/` landing · `/auth` · `/home` · `/chats`, `/chats/$id` · `/projects`, `/projects/$id` ·
`/tasks`, `/tasks/$id` · `/providers` · `/models` · `/github` · `/integrations` · `/search` ·
`/history` · `/memory` · `/usage` · `/notifications` · `/admin` · `/settings` · `/more`.

## Router & fallback
Policies: AUTO, PREFER_FREE, PREFER_CHEAP, PREFER_FAST, PREFER_STRONGEST, PREFER_CODING,
PREFER_LONG_CONTEXT, MANUAL. Inputs: capabilities, provider/model health, context length, price
class, preference. Failures are classified (AUTH_FAILED, RATE_LIMITED, PROVIDER_OFFLINE,
MODEL_UNAVAILABLE, CONTEXT_TOO_LARGE, TOOL_UNSUPPORTED, TIMEOUT, INVALID_RESPONSE); fallback is
capped by MAX_MODEL_ATTEMPTS and stops once streaming starts. Decision metadata is stored on
each assistant message.

## Multi-agent
Fixed role pipelines, each role with purpose, tool allowlist, routing policy, step limit and
structured result (`src/lib/agent/roles.ts`). No agent-to-agent chat. Progress shows operational
role status only.

## Plans & quotas
`src/lib/policy/plans.ts` holds FREE/STANDARD/PRO/ADMIN limits; enforced in server functions and
`/api/chat`. No payment integration.

## Android Beta 4 local processing and Telegram

Android SAF streams bounded UTF-8 files into the existing account-scoped Room file cache under LOCAL; no duplicate database or automatic cloud sync. FileInspector runs on Dispatchers.Default, computes SHA-256 and heuristic language/framework/symbol/warning inventory, formats JSON and creates processed/redacted previews. Exports create a user-selected document and preserve the source. Attachments require explicit review and are limited/redacted before the next chat request. The OS document picker is exempt from the immediate background PIN lock only while a user-initiated picker is active; process restart still restores the PIN lock.

ModelCatalog filters provider discovery records (no static model list). Empty or malformed prices remain UNKNOWN; free pricing distinguishes provider-verified evidence from custom-provider reports.

Telegram tokens use the existing AES-GCM key version/AAD, service-only secrets and owner-select metadata RLS. The authenticated API registers a fixed-origin Telegram webhook with an independent hashed secret, and only a configured numeric sender in a private chat is accepted. The Node process runs a bounded PostgreSQL inbox worker with atomic SKIP LOCKED claims, heartbeat leases, owner-scoped gateway access and persisted output/messages. Delivery is attempted once after a fenced SENDING transition; ambiguity is preserved rather than retried blindly. Project code is never executed by this bridge.

Agent UI reuses existing job/approval/change/validation engines. Worker configuration is reported to the client; unavailable worker/runtime is shown honestly. Full checkpointed resume of already-started agent steps and complete legacy feature parity remain outstanding.

### Beta 5 media path
Android uses platform BitmapFactory, MediaMetadataRetriever and PdfRenderer (no new native decoder dependency) and bounded previews. Source files remain on the device; SHA-256 uses 64KiB streaming buffers and checks cancellation. URI permissions and metadata are persisted in Room v3 via an explicit v2 migration. PDF analysis is first-page-only; video analysis is first-keyframe-only on API 27+, metadata-only on API 26. Previews are private application cache files and are removed on logout.

The authenticated API issues path-scoped signed uploads to private wakeel-uploads storage. Original uploads bypass the API process memory and stream from SAF through OkHttp. A service-only SECURITY INVOKER reservation RPC serializes per-owner quota with an advisory transaction lock. Attachment metadata has owner SELECT RLS and service-only writes. Vision attachments have verified size, MIME and signature; routing reuses the canonical model engine filtered by vision capabilities. User project code is never executed in either Android or API.
