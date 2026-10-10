import { build } from 'esbuild';
await build({entryPoints:{index:'src/index.ts',app:'src/app.ts',worker:'src/worker.ts',telegram:'src/telegram.ts',models:'../../src/lib/ai/models.ts',zipImport:'src/zip-import.ts'},outdir:'dist',bundle:true,platform:'node',format:'esm',target:'node22',packages:'external',external:['@supabase/*','zod','fflate','diff'],tsconfig:'tsconfig.json',sourcemap:true});
