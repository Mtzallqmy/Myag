# Android Beta 3 — acceptance evidence

## Installation repair
Beta 1 and Beta 2 APK signing certificates differed despite sharing `com.wakeel.app.beta`:
- Beta 1 certificate SHA-256: `6a828ebef5f189070ed2902d42ae267d7a5633fb02e4f51821ef0b8dc397fa2c`.
- Beta 2 certificate SHA-256: `6669f10245d40dfe7c657dbd80f1fc0eca9b398b56447e9efe04ace907a5fbfc`.

This prevents updating one with the other. The phone installer error code was not supplied, so it is a confirmed incompatibility and a likely cause, not a complete diagnosis of the device. Beta 3 uses `com.wakeel.app.beta3`, versionCode 3, label «وكيل · Beta 3», and can coexist with the earlier package. No old app data is deleted or automatically migrated across package IDs. Signing remains a tester certificate; stable production signing has not been provisioned.

## Local operation
Room now stores opened text files, scoped by account and project, limited to 50 files/project and 600,000 characters/file. On network I/O failure the app reads these files and searches cached filenames/text with line numbers, at most 200 results. Cache fallback does not mask HTTP/auth errors or cancellation. Lists and chat history retain the existing Room cache; DataStore settings, Keystore sessions/PIN, and WorkManager connectivity checks run locally. Local search runs on Dispatchers.Default. There is no local AI inference or execution of untrusted project code. First login, AI generation and integrations require the server. Logout/forgot PIN clears both caches. Room 1→2 migration adds a table without destroying existing rows. Cross-package copying is not implemented.

## Verification
- Kotlin unit tests, Android Lint, release assembly, APK signature v1/v2, package identity, minSdk 26, targetSdk 36, ZIP alignment and ABI inspection: **PASS** — executed successfully in [GitHub Actions run 38010945604](https://github.com/Mtzallqmy/Myag/actions/runs/38010945604), job 114090551485. Unit suite contains 7 tests: SSE framing (2), PIN derivation/validation/digit normalization (3), local search (2). Lint and release assembly succeeded. Default signature verification confirms v2; a separate explicit API 21 signature-only check confirms v1 and v2. App minSdk remains 26.
- Device installation, Android 8/newer UI, offline Room lifecycle/migration, PIN lifecycle: **not executed on a physical device**.
- Prior backend acceptance and remaining migration limits: `ANDROID_BETA_2_ACCEPTANCE.md` and `apps/android/BETA_NOTES.md`. Full feature parity is not claimed.

## Published artifact — 2026-10-10 UTC
- Source commit: `9d127f570b8508c00218062aa073792af1dff1d5`, migration branch only.
- [Beta 3 release](https://github.com/Mtzallqmy/Myag/releases/tag/wakeel-android-v0.1.0-beta.3).
- [APK](https://github.com/Mtzallqmy/Myag/releases/download/wakeel-android-v0.1.0-beta.3/wakeel-0.1.0-beta.3-arm64-compatible.apk): 9,945,686 bytes.
- SHA-256: `95378a27e250f4e23e938dd5b59fe96eb9553c0574d28ec0407692658a9f8aa6`. The published APK was downloaded; local size/hash match GitHub asset metadata. ZIP integrity and DEX presence checked successfully.
- Signing certificate SHA-256: `57e8fcb30c77e825b778e0a9f4520c3d2fa96956f7c4e281117472ad9def7abe`.
- Both native libraries are exclusively arm64-v8a. All ELF PT_LOAD segments in the downloaded APK align to 16,384 bytes. CI APK ZIP alignment also passed.
- Public deployed API `/health/live` and `/health/ready` returned HTTPS 200 with `ok` and `ready` during verification. This does not certify provider responses, GitHub writes, MCP or project runtime execution.
- Initial run 38010287480 failed one search preview fixture that accidentally matched `a.txt` by filename; corrected to `a.kt`. Run 38010591412 passed tests/lint/assembly but stopped on an incorrect v1 assertion in default API 26 verification. Neither failed run published an APK. Final run 38010945604 passed every check and published this release.
- PR #3 remains draft and mergeable; main was not modified. Full migration and physical device acceptance remain incomplete as documented above.
