# Android Beta 4 — executed acceptance

Date: 2026-10-10. This report distinguishes executed automated/HTTP checks from features still awaiting live integration/device acceptance.

## Artifact identity

- Source commit: `05796afb16909f88bc8b8322accc2330995dbfa0`, branch `migration/android-native-botkeep`.
- Prerelease: https://github.com/Mtzallqmy/Myag/releases/tag/wakeel-android-v0.1.0-beta.4
- APK: https://github.com/Mtzallqmy/Myag/releases/download/wakeel-android-v0.1.0-beta.4/wakeel-0.1.0-beta.4-arm64-compatible.apk
- Package: `com.wakeel.app.beta4`; versionCode 4; versionName `0.1.0-beta.4`; label «وكيل · Beta 4». Separate package avoids previous tester-certificate conflicts; does not migrate Beta 3 app data automatically.
- APK size: 10,027,607 bytes. SHA-256: `407f6fd0405ad9bfdfa3c33386b0005d4743b29b4a9a7120e68b71fc31980270`. Downloaded release bytes match GitHub asset digest; ZIP integrity passed.
- minSdk 26, target/compile 36. Actual packaged `.so` files are arm64-v8a ELF64/AArch64; both libraries have PT_LOAD alignment 16384. ZIP alignment with 16KB native alignment passed in CI.
- Test certificate SHA-256: `b503e13ab1d5273a363c679634f66e417d6d2f77e66c49a4728ba71dce915eb9`. v2 verified under API 26; explicit legacy verification also confirmed v1. This is not a stable production signing key.

## Executed checks

| Check | Actual result | Evidence and limit |
|---|---|---|
| Native Kotlin JVM unit tests | 11 passed, 0 failed/ignored | GitHub artifact HTML: SSE parser 2, PIN 3, local search 2, file inspector 3, catalog 1; no device/UI instrumentation |
| Android Lint / release assembly | Completed successfully | Lint HTML records 19 warnings; success does not mean warning-free or newest target SDK. No device run |
| Manifest/signing/ARM64/ZIP alignment | Passed | Native CI run 38016204586, job 114106910568; BUILD SUCCESSFUL, release published only after checks |
| API build/typecheck/tests | 23 tests passed, 0 failed | Local actual execution and CI run 38016204575/api job 114106910598; policy/HTTP/SSE/SQL/RLS/archive/pricing tests |
| Existing web TypeScript/tests/build | 71 tests passed, build completed | Same CI legacy job 114106910473; old source retained |
| Supabase Telegram migration | Applied successfully | Existing project ywtfvgkhrmouqxsocgdq; owner metadata/inbox SELECT RLS, secrets no client SELECT/INSERT, all four lease RPCs denied authenticated and permitted service_role |
| Supabase security advisor | Checked | Seven INFO notices for intentionally service-only tables with no client policy; WARN for leaked-password protection disabled. Remediation below |
| Live HTTPS Auth | Login 200, refresh 200, logout 200, invalid bearer 401 | Created a unique confirmed disposable user through Supabase Admin API, tested BotKeep HTTPS, deleted test user (200); owner password/roles unchanged |
| Live data reads | models/jobs 200 for test user | User-scoped empty environment; does not prove actual AI reply/agent execution |
| Live new API availability | capabilities 404, Telegram collection 400, webhook route-not-found 404 | Current host is still the prior API version; new source deployment NOT confirmed |

Native CI: https://github.com/Mtzallqmy/Myag/actions/runs/38016204586
API/legacy CI: https://github.com/Mtzallqmy/Myag/actions/runs/38016204575

Advisor: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . The service-only no-policy notices are intentional fail-closed architecture, not a reason to grant client access: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy .

## Deployment gate

BotKeep repository check resolved source 05796af and the correct migration branch. Merge-files synchronization was requested with restart, but paused at “Stopping the server safely”: “Infrastructure operation failed. Staff review or explicit retry is required.” An explicit Resume update was requested; final deployment is not yet confirmed. Startup is Node.js 22 with `cd services/api && npm ci --include=dev && npm run build && npm start`. HTTP liveness/readiness were 200 while the old API remained available. No success is inferred from the panel's cached Running label.

## Not tested / not complete

- Physical ARM64 installation, Android 8/newer UI behavior, SAF round trip, PIN/background lifecycle, performance, accessibility and transitions: user device acceptance pending.
- Actual model discovery/AI reply/proxy SSE with a real provider; free-model availability and paid fallback cost; no fabricated provider responses.
- Actual Telegram bot delivery: requires user-supplied bot token and allowed numeric sender after updated API deployment. Tests use adapter/SQL fixtures and do not prove Telegram delivery.
- Live ZIP persisted ingestion and agent scheduling: blocked until new source deployment; local real ZIP validator tests passed.
- Isolated Runtime remains unavailable; project code is not executed in BotKeep/API/Android and unavailable tests are not PASS.
- Complete checkpoint recovery for already-started agent steps, full GitHub/MCP native workflows, admin role/plan/quota/flag/statistics UI parity, original unavailable Supabase history transfer and production signing remain outstanding.
- Future AST/LSP/PDF/OCR/directory sync/editor features are proposals in BETA_4_DEVELOPMENT.md, not claimed as implemented.
