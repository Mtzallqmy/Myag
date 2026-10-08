# Roadmap

## Stage 1 (done)
- [x] Auth, providers, models, routing, streaming chat, PWA
- [ ] End-to-end manual testing — user will test later

## Stage 2 (done)
- [x] DB: projects, files, symbols, chunks, jobs, steps, approvals, change_sets, validation_runs, github_*, mcp_*, integration_registry + private storage bucket
- [x] Projects UI: list, new, upload (ZIP + text/source files), safe archive extraction, status
- [x] Scanner: languages, frameworks, package managers, manifests
- [x] Search: filename, text, symbol
- [x] File browser with breadcrumbs, line numbers, LTR code
- [x] Ask Project (grounded Q&A with file refs)
- [x] Agent jobs (READ_ONLY / SUGGEST / WORKSPACE), bounded steps, realtime progress
- [x] Diff viewer + change sets
- [x] Approvals with expiry, tool policy registry
- [x] Runtime adapter contract; truthful "unavailable" when not configured
- [x] GitHub via fine-grained PAT (encrypted): repos, issues/PRs read, import, branch/commit/PR with approval, default-branch protection
- [x] MCP servers (Streamable HTTP, SSRF-guarded), tool discovery, risk levels, output sanitizer
- [x] Integration registry + audit events
- [x] Tests + README updates

- [ ] End-to-end testing with real accounts (GitHub token, MCP OAuth server) — user will test later
- [ ] External isolated runtime — needs deployment + AGENT_RUNTIME_* secrets

## Stage 3
- [ ] Waiting for user's third prompt

## Stage 3 (done)
- [x] Agent depth modes + bounded multi-agent roles + role progress
- [x] Memory, history, global search, usage, quotas/plans, notifications (realtime)
- [x] Admin RBAC, feature flags, kill switches, audit search, health, app events
- [x] Docs: ARCHITECTURE, SECURITY, BACKUP_RESTORE, CAPACITOR_ANDROID, BETA_RELEASE_CHECKLIST, CHANGELOG
- [ ] Live end-to-end Beta scenario — waits on user's provider token + test account
- [ ] GitHub sync — user connects project to GitHub in Lovable
