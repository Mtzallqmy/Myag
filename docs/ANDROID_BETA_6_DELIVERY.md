# Beta 6 delivery and deployment checkpoint — 2026-10-10

## Delivered source and APK

Migration branch: migration/android-native-botkeep. Review PR #3 remains draft and mergeable; no main writes.
Android tester release: https://github.com/Mtzallqmy/Myag/releases/tag/wakeel-android-v0.1.0-beta.6
APK: https://github.com/Mtzallqmy/Myag/releases/download/wakeel-android-v0.1.0-beta.6/wakeel-0.1.0-beta.6-arm64-compatible.apk

APK source: 6fb7f545d96671ccfc773873eec2d7ef79dc261e.
Package com.wakeel.app.beta6; versionCode 6; versionName 0.1.0-beta.6; minSdk 26; targetSdk 36.
Size 10,109,528 bytes. SHA256 f9def9e0c611c3ebe416609fc5a8b41f84f9360e67177d009d3e4dde44386ea7.
Tester certificate SHA256 59668f3b88b480d48ef45ed4931c57b4c3eef6b2eb3296e0555f4f92a1e92c28.
Uses a tester debug certificate. Stable production signing and physical ARM64 installation are unverified.

## Implemented in this iteration

- Native local streaming file hashes, media metadata, image previews, PDF first-page preview and API27+ video keyframe preview, owner-scoped Room cache and cancellable processing.
- Private direct Supabase uploads with explicit consent, owner isolation, atomic quotas, final size/MIME verification and image signature checks. Original-file limit 50MiB; vision preview 1MiB; maximum four attached images.
- Vision-aware real provider routing and persisted attachment references, safer chat cancellation/state transitions, model list/test fixes, Markdown rendering reuse.
- Canonical server agent role/depth profiles and uncached real connection diagnostics. PostgreSQL job worker enabled in hosting configuration.
- Native GitHub connection/discovery/import/issues/pull-request reads and MCP discovery, system-browser OAuth, tool permissions and approved manual calls. Credentials remain on the server.
- Safer GitHub ownership/deletion/synchronization error handling and Telegram webhook ownership checks.
- Fastify upgraded to 5.12.5, secret-safe LogController configuration and public health version 0.6.0.

## Executed checks

Android CI 38072569406/job 114272850278 succeeded: 13 Kotlin unit tests, lint with 23 warnings, APK assembly/signature/alignment/SDK/native ARM64 checks. Artifact 11677710910 contains actual reports.
Beta 6 API/legacy CI 38072569383 succeeded: 28 API tests, 71 shared-domain tests and builds.
Latest security source dfc3b1702d7147e509777aa1fd3105d4132e7020: 29 API tests, typecheck and build passed locally; production dependency audit returned zero known vulnerabilities. API/legacy CI 38073148673 completed success (jobs 114274534268 and 114274534455).
Supabase private-upload migration applied to existing project ywtfvgkhrmouqxsocgdq; bucket remains private, owner-read RLS is enabled, direct client writes and quota RPC execution denied, service-role RPC enabled. Existing provider/model data retained.

## BotKeep checkpoint

GitHub source staging was interrupted without replacing application files; canceled/restored it.
Compiled services/api/dist/index.js and API package/lockfiles were uploaded through Files UI. Startup: cd services/api && npm ci --include=dev && npm start. Existing secret environment settings retained; WAKEEL_WORKER_ENABLED saved true.
Initial deployed Beta 6 API returned HTTPS live/ready 200 at https://wvcvrb.bot-keep.xyz/; protected agent profiles returned 401 without session; Telegram webhook route returned its own invalid-bot 404.
Latest patched package/lockfiles and compiled index were uploaded successfully, then Restart requested. BotKeep showed Starting and daemon image-pull output. During restart, HTTP probes returned 503. The workspace/browser execution transport then disconnected and recovery timed out. Final post-restart health/version and a screenshot could not be obtained. Do not claim final patched production readiness until /health/live returns version 0.6.0 and /health/ready returns 200.

## Remaining acceptance and functionality

No real authenticated AI/vision response or proxy SSE timing, cloud upload roundtrip, GitHub/MCP/Telegram token acceptance, agent execution/restart acceptance or physical-device media decoder test is claimed.
Automatic approval review rejected generating/redeeming an admin magic link for the existing owner as an authentication bypass. No impersonated session was created or alternative bypass attempted; use normal authenticated access.
Whole-video/audio/full-PDF extraction, local LLM runtime, automatic native App Links and complete legacy admin parity remain incomplete. Isolated project runtime must report UNAVAILABLE when absent. Approval-gated repository writes remain governed by the existing server agent engine.
This is an experimental beta and is not complete web-feature parity. Earlier acceptance documents describe chronological checkpoints; this document supersedes their deployment-pending status only to the extent explicitly verified above.
