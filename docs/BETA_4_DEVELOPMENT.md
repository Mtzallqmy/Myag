# Wakeel Beta 4 — development scope

This extends the current Android app and existing server operations. The legacy web app and shared agent/routing/approval engines remain canonical sources of business logic. No model list or execution success is fabricated.

| Area | Implement in this beta | Next development |
|---|---|---|
| Local files | Android document picker, bounded UTF-8 reading, Room library, SHA-256, language/framework hints, symbol/line inventory, secret/dynamic execution/TODO hints, JSON validation/formatting, whitespace processing, redacted export, local search | Tree-sitter AST/LSP indexing, directory snapshots, PDF/OCR adapters with size limits |
| Projects | Explicit upload/import of small ZIP through existing safeExtractZip/private archives/chunk index; file analysis UI | Incremental sync, resumable large uploads, scoped workspace editor |
| Chat | Fixed composer, native code cards with copy/language, attachment review with redaction, stream status, follow/stop-follow scrolling, prompt shortcuts, model picker filters and routing preference | Conversation branching, prompt library, searchable message history, multimodal uploads only where supported |
| Models | Discover from providers, distinguish FREE_VERIFIED/FREE_REPORTED/PAID/UNKNOWN, search, capability filter, context sorting, provenance-aware prices | Quota/budget dashboard, measured throughput/latency, versioned benchmark results; no inferred benchmark scores |
| Agents | Expose existing mode/depth and fixed analysis/implementation/review/security/testing pipeline, capability-aware scheduling, progress/changes/validation, cancellation | AST-grounded patches, checkpointed step resume, isolated external runtime, regression gates, autonomous PR preparation via approvals |
| Telegram | Token connection/testing, AES-GCM server secrets, explicit webhook activation/removal, private sender allowlist, durable deduplicated inbox and bounded worker using the same AI gateway | Document import, approval buttons, scheduled reports, per-bot project binding; no unrestricted repository writes |
| UX | Arabic/English local labels, Material cards, transitions, local capability/readiness states, accurate failures | Tablet navigation rail, accessibility UI tests and device acceptance |
| Reliability | Backend integration tests, Room ownership isolation, no auth-error cache bypass, pending/failed/uncertain states, Android CI and beta release | Stable production signing, complete phone acceptance, runtime isolation and deployment acceptance |

Heuristic file warnings are not proof of vulnerability or build success. Files stay on the phone unless the user explicitly attaches or imports them. No untrusted project code runs in the API or local app process. Telegram is read/chat only and restricted to the configured private sender. Paid-model selection may consume the provider account budget; free classification records discovery evidence and may change on refresh.

Status and actual acceptance results will be recorded before the beta release is delivered. Proposed future work is not counted as implemented functionality.
