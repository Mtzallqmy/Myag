# Beta 5 acceptance status

Source adds local media inspection, private direct uploads and preview-based vision chat, real uncached connection diagnostics, canonical multi-agent role visibility, model test/list fixes and safer chat state/performance.

Executed locally: API build + TypeScript check; 27/27 API tests; 71/71 shared-domain Vitest tests. Fresh schema tests include owner attachment isolation, denied client writes/RPC execution, private bucket, atomic count quota and pessimistic pending-byte quota. Uploaded image signatures and manual/provider-kill routing gates have regression tests.

Supabase migration `wakeel_media_uploads` applied successfully to existing project ywtfvgkhrmouqxsocgdq. Existing provider/model data retained (one provider, 458 discovered models).

Android Gradle/unit/lint/assembly, actual APK signature verification, real storage uploads, production health and real-provider response results will be recorded after they execute. No PASS is claimed for pending checks. Android API 26 physical device/ARM64 installation and native decoder correctness have not yet been tested on a device.

Known limits: 50MiB original uploads, 1MiB vision preview, four attached previews, 100 local media entries, 50/500MiB cloud records/verified bytes with 50MiB reserved per pending URL. Video preview covers one keyframe (API 27+), PDF preview one page. No whole-video/audio/full-PDF extraction. Cloud deletion waits two hours for signed upload expiration; no automatic purge.

Auth test limitation: automatic approval review rejected creating/redeeming an admin magic link for the existing owner as an authentication bypass. This flow was not retried. Provider-response testing must use normal authenticated access; account authorization is preserved.

Android CI run 38072034458 / job 114271239652 completed SUCCESS: Kotlin unit tests, lint and release assembly, v1/v2 signature checks, zipalign with 16KiB alignment, min API26/target36 and native-library arm64-v8a-only checks. Tester prerelease beta.5 published from source 1fbf87f16aeaf1883813271d977988234ff2826f. Physical installation and actual media decoding remain untested.
API + legacy CI run 38072034455 completed SUCCESS including legacy web build.
