# Wakeel Native Android beta

Canonical native Android implementation for the migration branch; the legacy web app remains intact. This is an early tester beta, not feature parity with the web app. See BETA_NOTES.md.

Build with JDK 17, Android SDK 36 / build tools 36.0.0, and Gradle 8.13:

```sh
gradle :app:testDebugUnitTest :app:lintDebug :app:assembleRelease
```

CI uses the same command. Kotlin 2.2.21, AGP 8.13.2 and pinned dependencies; minSdk 26, target/compile 36. No production signing keys have been provided. The first beta uses a test certificate and package `com.wakeel.app.beta`; production remains a separate future signing decision.

Practical MVVM: feature ViewModel owns StateFlow/UI requests, repository reuses the existing versioned Fastify operations, core manages session encryption and SSE framing, Room caches owner-scoped reads, DataStore stores encrypted sessions/settings. Hilt constructs dependencies. WorkManager only performs bounded public readiness checks; it never runs user code or duplicates the server agent worker.

Markwon 4.6.2 renders Markdown in a selectable native TextView inside Compose. It introduces no browser execution. OkHttp performs cancellable SSE on an IO dispatcher; closing the call cancels upstream through the API contract. HTTP errors are visible and cache fallback is limited to transport failures. Session renewal goes through API; server Auth/RLS determines authorization.

App backup and cleartext networking are disabled; credentials never enter APK BuildConfig. No networking logger is installed. The Supabase publishable key is public configuration, used only for sign-up; server keys stay in BotKeep.
