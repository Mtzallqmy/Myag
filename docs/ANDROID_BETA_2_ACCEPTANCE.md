# Android Beta 2 — acceptance boundaries

Owner access was repaired on 2026-10-10 (Asia/Aden). Supabase Auth logs showed `invalid_credentials`; email confirmation was already complete. The existing confirmed owner account was explicitly assigned SUPER_ADMIN and ADMIN plan. Its password was reset using the server-only Auth Admin API; a real login through the deployed BotKeep API succeeded. Credentials and session tokens are not included in this report, source or APK.

Beta 2 adds an optional device PIN, encrypted verifier, persisted failed-attempt cooldown, background/relaunch lock, explicit forgotten-PIN session clearing, account password change within an authenticated session and useful login errors. The PIN never grants server authority. Bearer verification, RLS and server permissions remain in effect. No endpoint signs a user in merely because an email matches.

PIN derivation unit tests exercise a correct PIN, rejection of a wrong PIN and a different salt, and malformed-input rejection. Native CI executes the tests, lint, release build, signature and API/ABI checks before publishing. Actual execution results will be recorded after completion.

This remains a partial migration. Full agent execution/recovery, ZIP/GitHub import, OAuth flows, advanced diff review and full administration UI are not complete. No actual model answer or real-device PIN/network/lifecycle test is claimed. The runtime is unavailable and the worker remains disabled. See BETA_NOTES.md and MIGRATION_STATUS.md for full limits.
