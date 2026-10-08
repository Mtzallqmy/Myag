import { build } from 'esbuild';
await build({entryPoints:['src/index.ts','src/app.ts','src/worker.ts'],outdir:'dist',bundle:true,platform:'node',format:'esm',target:'node22',packages:'external',external:['@supabase/*','zod','fflate','diff'],tsconfig:'tsconfig.json',sourcemap:true});
