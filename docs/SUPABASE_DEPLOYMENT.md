# Supabase deployment — 2026-10-09 (Asia/Aden)

The user explicitly authorized selecting any accessible Supabase project and completing its setup, with BotKeep publication performed manually by the user.

## Selected environment

- Existing project: Moatazahmedalz, `ywtfvgkhrmouqxsocgdq`, ap-southeast-1.
- Restored from INACTIVE; verified ACTIVE_HEALTHY before writes.
- Preflight: seven empty Rateel catalog tables, no public helper functions/enum collisions, no Auth user triggers, zero Auth users, no storage buckets.
- Those seven tables and their policies were preserved. 42 Wakeel tables were added using the existing project's source SQL and queue migration.
- Original Wakeel database `iwzzseqztdxrrqlbazip` is inaccessible through connected accounts. No old users, history or encrypted credentials were transferred; no original data was deleted.

## Applied migrations

| Remote name | Source |
| --- | --- |
| `wakeel_core` | `drizzle/migrations/0000_migration.sql` |
| `wakeel_projects_agents_github_mcp` | `drizzle/migrations/0001_stage2_projects_agents_github_mcp.sql` |
| `wakeel_admin_memory_notifications` | `drizzle/migrations/0002_stage3_admin_memory_notifications.sql` |
| `wakeel_remove_unused_role_helper` | `drizzle/migrations/0003_drop_unused_has_role.sql` |
| `wakeel_durable_agent_execution` | `supabase/migrations/20261008032239_durable_agent_execution.sql` |
| `wakeel_private_archives_and_event_grants` | `supabase/migrations/20261008223240_wakeel_private_archives_and_event_grants.sql` |

Do not reapply these to this database. The first four remain in their original Drizzle history; remote application is explicitly recorded above, rather than inventing a second set of baseline files. One RPC request expired during migration 4; remote migration history was inspected before retrying, and the absent migration was then applied successfully.

## Executed live verification

- All 49 public tables have RLS enabled.
- `services/api/test/live-db-acceptance.sql` executed successfully on the live project: Auth insert trigger creates profiles/routing preferences; owner reads work; another user cannot read the conversation or insert with forged ownership; clients cannot read provider/GitHub/MCP secrets, OAuth states, internal events or the durable queue, or call the worker claim RPC.
- Test fixtures ran in a transaction followed by ROLLBACK. Post-test counts: zero Auth users, zero conversations. No test credentials/accounts persisted.
- Private `project-archives` bucket exists, `public=false`, ZIP-only, maximum 52,428,800 bytes.
- Realtime publication contains conversations, projects, agent_jobs, agent_job_steps, approvals and notifications.
- Security Advisor: no WARN/ERROR findings; six INFO notices for intentional server-only RLS tables without client policies. Client grants are denied for all six. Explanation: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## Still requires deployment acceptance

Real Supabase Auth login/refresh/logout, provider replies, uploads, workers, MCP/GitHub integration and BotKeep proxy SSE have not been tested against the published API. API keys/encryption key are not in this repository. Follow `BOTKEEP_DEPLOYMENT.md` for manual Environment setup, and provide the deployed HTTPS API origin afterward. Android remains pending.
