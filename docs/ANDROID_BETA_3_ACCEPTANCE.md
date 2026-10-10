# Android Beta 3 — acceptance evidence

## Installation repair
Beta 1 and Beta 2 APK signing certificates differed despite sharing `com.wakeel.app.beta`:
- Beta 1 certificate SHA-256: `6a828ebef5f189070ed2902d42ae267d7a5633fb02e4f51821ef0b8dc397fa2c`.
- Beta 2 certificate SHA-256: `6669f10245d40dfe7c657dbd80f1fc0eca9b398b56447e9efe04ace907a5fbfc`.

This prevents updating one with the other. The phone installer error code was not supplied, so it is a confirmed incompatibility and a likely cause, not a complete diagnosis of the device. Beta 3 uses `com.wakeel.app.beta3`, versionCode 3, label «وكيل · Beta 3», and can coexist with the earlier package. No old app data is deleted or automatically migrated across package IDs. Signing remains a tester certificate; stable production signing has not been provisioned.

## Local operation
Room now stores opened text files, scoped by account and project, limited to 50 files/project and 600,000 characters/file. On network I/O failure the app reads these files and searches cached filenames/text with line numbers, at most 200 results. Cache fallback does not mask HTTP/auth errors or cancellation. Lists and chat history retain the existing Room cache; DataStore settings, Keystore sessions/PIN, and WorkManager connectivity checks run locally. Local search runs on Dispatchers.Default. There is no local AI inference or execution of untrusted project code. First login, AI generation and integrations require the server. Logout/forgot PIN clears both caches. Room 1→2 migration adds a table without destroying existing rows. Cross-package copying is not implemented.

## Verification
- Kotlin unit tests, Android Lint, release assembly, APK signature v1/v2, package identity, minSdk 26, targetSdk 36, ZIP alignment and ABI inspection: **pending CI execution**.
- Device installation, Android 8/newer UI, offline Room lifecycle/migration, PIN lifecycle: **not executed on a physical device**.
- Prior backend acceptance and remaining migration limits: `ANDROID_BETA_2_ACCEPTANCE.md` and `apps/android/BETA_NOTES.md`. Full feature parity is not claimed.
