# Beta 6 acceptance status

Retains Beta 5 media, vision previews and diagnostics. Adds native GitHub PAT connection/discovery/repository import/issue and pull-request reads, and MCP Streamable HTTP/Bearer/OAuth browser authorization/tool-resource discovery/tool permissions/manual approved calls. No integration token is persisted in Android. Server policy still governs writes.

Fixes GitHub disconnect to use a caller-RLS ownership read followed by owner-filtered service deletion. Repository synchronization now throws on database failures. Telegram disconnect deletes only the webhook URL owned by this Wakeel instance, including after a prior disable failure.

API build/typecheck and shared TypeScript checks executed after these changes. 28/28 API tests executed and passed. Android CI/artifact evidence will be updated after execution. Real GitHub/MCP/Telegram service acceptance needs supplied tokens and actual endpoints; no such service result is claimed from compilation. MCP OAuth returns through the server callback; native automatic App Links return remains incomplete.

BotKeep: explicit Stop moved the server Offline; GitHub import advanced from safe-stop to source staging then paused with “Source staging was interrupted. Existing application files were not changed.” Cancel/restore was requested to release the operation. Deployment is not successful until HTTP readiness and the new protected routes are confirmed. Repository source is 272 tracked files / ~2.22MB, within the displayed BotKeep import limits (1000 files / 20MB / 4MB per file).

See Beta 5 acceptance for preview coverage, storage limits, authentication-test restriction and missing physical-device/runtime acceptance. This remains an experimental beta, not full web-feature parity.
