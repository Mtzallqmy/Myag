# Backup & Recovery

## Database
- Lovable Cloud runs managed daily backups of the database. For extra safety, export critical
  tables on a schedule (projects, conversations, messages, agent_jobs, audit_logs, memory tables).
- Ciphertext tables (`provider_secrets`, `github_credentials`, `mcp_credentials`) are useless without
  `PROVIDER_ENCRYPTION_KEY_V1`. Back up the key separately in a password manager — never in the repo.

## Storage
- `project-archives` (private) holds uploaded ZIPs under `<user_id>/`. Project content is already
  in `project_chunks`, so archives are a convenience copy; retain 30 days, then delete.

## Restore procedure
1. Restore the database from the managed backup (Lovable support / Cloud settings).
2. Confirm the encryption key secret matches the backup era; otherwise ask users to re-enter tokens.
3. Re-run the security linter and verify RLS on every public table.
4. Flip `disable_new_agent_jobs` and `disable_external_writes` ON during restore; OFF after verification.

## Secret rotation
- Encryption key: add `PROVIDER_ENCRYPTION_KEY_V2`, re-encrypt rows server-side, then remove V1.
- Runtime HMAC secret: rotate on both the app and the runtime simultaneously.

## GitHub token revocation
Users delete the PAT on GitHub (Settings → Developer settings) and press Disconnect in the app,
which deletes the ciphertext. Admins can enable `disable_github_push` instantly.

## MCP token revocation
Disconnect/delete the server in Integrations (deletes stored tokens), revoke the client at the
authorization server, and use `disable_mcp_writes` for emergencies.
