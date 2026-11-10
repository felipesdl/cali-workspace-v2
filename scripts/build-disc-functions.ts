import { resolve } from 'node:path';
import { build } from 'vite';

// Gera somente o bundle; não inicia serviços, conecta ao banco ou dispara comunicação.
await build({
  configFile: false,
  logLevel: 'warn',
  assetsInclude: ['**/*.wasm'],
  build: {
    target: 'esnext',
    minify: true,
    outDir: 'supabase/.temp/workspace-disc-pilot',
    emptyOutDir: false,
    lib: {
      entry: resolve('supabase/functions/workspace-disc-pilot/index.ts'),
      formats: ['es'],
      fileName: () => 'index.ts',
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
process.stdout.write('Bundle DISC do piloto gerado sem iniciar runtime ou enviar e-mail.\n');
