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
