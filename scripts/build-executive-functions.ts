import { resolve } from 'node:path';
import { build } from 'vite';

// Incorpora fontes e WASM; não inicia serviços nem conecta ao Supabase.
await build({
  configFile: false,
  logLevel: 'warn',
  assetsInclude: ['**/*.wasm'],
  build: {
    target: 'esnext',
    outDir: 'supabase/.temp/workspace-executive-pdf',
    emptyOutDir: true,
    lib: {
      entry: resolve('supabase/functions/workspace-executive-pdf/index.ts'),
      formats: ['es'],
      fileName: () => 'index.ts',
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
process.stdout.write('Bundle do PDF executivo gerado localmente.\n');
