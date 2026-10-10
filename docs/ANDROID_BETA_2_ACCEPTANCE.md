# Android Beta 2 — acceptance boundaries

Owner access was repaired on 2026-10-10 (Asia/Aden). Supabase Auth logs showed `invalid_credentials`; email confirmation was already complete. The existing confirmed owner account was explicitly assigned SUPER_ADMIN and ADMIN plan. Its password was reset using the server-only Auth Admin API; a real login through the deployed BotKeep API succeeded. Credentials and session tokens are not included in this report, source or APK.

Beta 2 adds an optional device PIN, encrypted verifier, persisted failed-attempt cooldown, background/relaunch lock, explicit forgotten-PIN session clearing, account password change within an authenticated session and useful login errors. The PIN never grants server authority. Bearer verification, RLS and server permissions remain in effect. No endpoint signs a user in merely because an email matches.

PIN derivation unit tests exercise a correct PIN, rejection of a wrong PIN and a different salt, and malformed-input rejection. [Native CI run 38007116322](https://github.com/Mtzallqmy/Myag/actions/runs/38007116322) actually passed unit tests, lint, release build, signature and API/ABI checks, then published the prerelease from source commit `9c531d1ff8b957895226c9852bc91a0e346a0c10`.

## Published APK

- [Beta 2 release](https://github.com/Mtzallqmy/Myag/releases/tag/wakeel-android-v0.1.0-beta.2)
- APK: `wakeel-0.1.0-beta.2-arm64-compatible.apk`, 9,931,480 bytes.
- SHA-256: `5e7e377dc3e7e036395dec138ec53c012fffa2d653fe62a3272996e4e250ab71`.
- minSdk 26, targetSdk 36, arm64-v8a native libraries only, Android test signing certificate. A certificate mismatch when updating Beta 1 can require uninstalling it first.

## Executed live API checks

Login via BotKeep succeeded after the owner password reset. `getMyAccess` returned SUPER_ADMIN, ADMIN plan and `canClaimAdmin:false`. Authenticated reads of conversations, providers, models, projects, jobs, approvals, MCP servers, memory, notifications and history returned 200; empty results are not evidence of functioning external integrations.

An explicitly named temporary acceptance project was created. A TypeScript file was ingested (accepted 1, rejected 0), finalization reported fileCount 1, file reading returned the exact source, and search returned the function in symbol and text results. The test project has not been confirmed deleted; its name is `Beta 2 technical acceptance temporary`.

GitHub collection reading returned 503 because the API selected nonexistent `github_login` instead of database `account_login`. The source now uses a PostgREST alias and a schema-backed test validates all HTTP read projections against the complete migrations. Standalone API build, TypeScript check and all 15 tests passed locally with the correction. Deployment of this latest API correction remains pending: the BotKeep panel session was signed out and its secure sign-in request timed out. No successful live GitHub retest is claimed.

This remains a partial migration. Full agent execution/recovery, ZIP/GitHub import, OAuth flows, advanced diff review and full administration UI are not complete. No actual model answer or real-device PIN/network/lifecycle test is claimed. The runtime is unavailable and the worker remains disabled. See BETA_NOTES.md and MIGRATION_STATUS.md for full limits.
