# Wakeel standalone API (migration in progress)

Node.js 22+, Fastify 5, TypeScript bundled to JavaScript. Existing business logic is in `../../src/lib/operations/`; no TanStack runtime or Lovable dependency in API output.

From the repository root:

```sh
npm ci --prefix services/api
npm run build --prefix services/api
npm run typecheck --prefix services/api
npm test --prefix services/api
# Set Environment secrets first, then:
cd services/api
npm start
```

The build needs the whole repository (shared source lives under src). `npm start` runs only the compiled service. Do not publish with a regenerated encryption key. Use `SUPABASE_PUBLISHABLE_KEY` in addition to existing server secrets to create caller-scoped clients.

See `../../docs/BOTKEEP_DEPLOYMENT.md`, `../../docs/API_CONTRACT.md`, `../../docs/MIGRATION_STATUS.md`.

The worker is opt-in until the queue migration has been applied and live acceptance has run. Interrupted in-progress tasks are explicitly marked INTERRUPTED; automatic checkpoint replay is not yet implemented. Do not claim this service meets the full restart-resume acceptance gate.
