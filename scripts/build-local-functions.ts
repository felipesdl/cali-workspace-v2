import { resolve } from 'node:path';
import { build } from 'vite';

// Zod e contratos são empacotados no host; Edge internal não baixa dependências.
await build({
  configFile: false,
  logLevel: 'warn',
  build: {
    target: 'esnext',
    minify: true,
    outDir: 'supabase/.temp/workspace-access',
    // O CLI monta este arquivo: removê-lo durante rebuild quebra o mount do worker ativo.
    emptyOutDir: false,
    lib: {
      entry: resolve('supabase/functions/workspace-access/index.ts'),
      formats: ['es'],
      fileName: () => 'index.ts',
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
process.stdout.write(
  'Bundle local de workspace-access gerado, sem credenciais ou dependências remotas.\n',
);
