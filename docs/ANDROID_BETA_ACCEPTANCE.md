# Native Android tester beta — execution record

The user authorized this early prerelease and will test device performance. This is a partial native migration, not a declaration of feature parity or production acceptance. The web application remains available as a reference.

## Published artifact

| Property | Verified value |
| --- | --- |
| Version | 0.1.0-beta.1 / versionCode 1 |
| Package | com.wakeel.app.beta |
| Source commit | 8e492dee7a703157d9ddaca3a9848aa27eb6ba67 |
| Minimum / target SDK | 26 (Android 8.0) / 36 |
| Native ABI | arm64-v8a only |
| APK size | 9,915,096 bytes |
| SHA-256 | b447c13ce453d964d5041aaddada8901b6fd4338801dd7eaea6aa61f547ac69f |
| Signing | Android test certificate; APK Signature Scheme v2 verified |

[GitHub prerelease](https://github.com/Mtzallqmy/Myag/releases/tag/wakeel-android-v0.1.0-beta.1)

[Download APK](https://github.com/Mtzallqmy/Myag/releases/download/wakeel-android-v0.1.0-beta.1/wakeel-0.1.0-beta.1-arm64-compatible.apk)

The published APK was downloaded and its size, SHA-256 and ZIP native-library entries checked independently. The only native libraries are `lib/arm64-v8a/libandroidx.graphics.path.so` and `lib/arm64-v8a/libdatastore_shared_counter.so`. The test certificate is not a production signing identity; a later build with a different certificate can require uninstalling this beta first.

## Checks actually executed

- [Android CI run 38004665188](https://github.com/Mtzallqmy/Myag/actions/runs/38004665188): `:app:testDebugUnitTest`, `:app:lintDebug`, and `:app:assembleRelease` succeeded. The SSE parser unit suite covers complete Arabic events and CRLF/comment/multiline framing. Build warnings remain; this report does not claim warning-free output.
- The same run verified the APK signature, manifest minimum/target SDK, DEX presence and absence of other native ABIs, then uploaded the APK, manifest and checksum to a GitHub prerelease.
- [Backend and legacy CI run 38004665178](https://github.com/Mtzallqmy/Myag/actions/runs/38004665178): both jobs succeeded, including TypeScript checks, tests and builds.

No physical device, emulator, Android 8/other OS runtime, live provider conversation, actual BotKeep SSE proxy, session expiry end-to-end, GitHub mutation, MCP OAuth, task restart or network reconnection acceptance test was executed for this APK. The user will supply device observations. Successful compilation does not establish these outcomes.

## Scope and remaining work

See [Arabic beta notes](../apps/android/BETA_NOTES.md) for available screens and specific limitations, [migration audit](MIGRATION_AUDIT.md) for feature mapping, and [migration status](MIGRATION_STATUS.md) for backend/database state. Full agent execution, ZIP/GitHub import, OAuth integration flows, diff review and administration parity remain incomplete. No final production APK is declared. The release is connected to the existing deployed API origin `https://wvcvrb.bot-keep.xyz/`; server credentials are not embedded in the APK.
