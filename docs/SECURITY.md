# Security

## Data access
- RLS is enabled on every public table. Users read their own rows; most writes go through server
  functions that check ownership and then use the admin client.
- Stage 3 tables: `user_roles`, `user_plans` (read own; written only by server), `feature_flags`,
  `kill_switches` (readable; written only by admins via server), `notifications` (read/mark/delete
  own), memory tables (read/delete own; inserts only via validated server path), `app_events`
  (no client access).
- Admin authorization is server-side (`staffCan` + `user_roles` read via the caller's session).
  The admin page is not a security boundary — every admin server function re-checks roles.
- Roles: SUPER_ADMIN (all + roles), ADMIN (write flags/switches/plans), AUDITOR (audit), SUPPORT /
  READ_ONLY (read). The first user can claim SUPER_ADMIN only while none exists (audited).

## Secrets
- Provider/GitHub/MCP tokens are AES-GCM ciphertext, server-only. Logs and audit metadata pass
  through `redactValue`. Memory refuses passwords, tokens, keys and secret headers.

## Network
- Outbound calls to user URLs use `safeFetch` (HTTPS, public IPs, per-hop redirect checks).
- MCP OAuth uses PKCE + state; callback under `/api/public/` validates state server-side and only
  redirects to same-origin paths.

## Rendering
- Model output renders through react-markdown without raw HTML; no `dangerouslySetInnerHTML` for
  untrusted content. Links open with `rel="noopener noreferrer"`.

## Prompt injection
Trust labels: SYSTEM_POLICY, USER_REQUEST, PROJECT_CONTENT, GITHUB_CONTENT, MCP_RESOURCE,
MCP_PROMPT, TOOL_RESULT. Only SYSTEM_POLICY and USER_REQUEST can direct the agent. Tool
permissions, approvals and secret policy live in code (`policy.ts`) and cannot be changed by text.

## Kill switches (server-enforced)
`disable_new_agent_jobs`, `disable_external_writes` (implies push + MCP writes),
`disable_github_push`, `disable_mcp_writes`, `disable_uploads`, `disable_provider` (optionally
targeted at one provider id).

## Runtime
Project code is never executed in the app. Build/test require the external HMAC-signed runtime;
when absent, validation reports UNAVAILABLE — never a fake pass.
