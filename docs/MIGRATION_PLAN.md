# Sequential migration plan

Branch: `migration/android-native-botkeep`. Source of truth: Mtzallqmy/Myag.

1. Audit the original feature inventory, repair missing imports, record API contract and existing DB identity. Commit/push.
2. Extract transport-independent operations reused by TanStack and Fastify. Preserve crypto, safeFetch, guards, RLS and runtime contract. Add health/auth/validation/rate limits, streaming bridge and PostgreSQL durable scheduling. Commit/push after verification.
3. Kotlin Compose app under apps/android, Arabic/English/dark, native auth/chat/projects/jobs/providers/GitHub/MCP/admin. Add Keystore, Room/DataStore and network/state handling. Commit/push after compilation/tests.
4. Execute real integration acceptance against the existing Supabase project, providers, GitHub, MCP and isolated runtime; test restart/network recovery. Commit/push.
5. Native CI, BotKeep deployment/configuration and real proxy test, verified ARM64 beta artifact. No final or beta release before acceptance gates.

External dependency: the existing Supabase project iwzzseqztdxrrqlbazip is not accessible through currently connected accounts. Preserve it; do not create a replacement. Deployment requires its current secrets (including the original encryption key), BotKeep account access and a verified HTTPS origin.
