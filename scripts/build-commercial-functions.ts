import { resolve } from 'node:path';
import { build } from 'vite';

await build({
  configFile: false,
  logLevel: 'warn',
  build: {
    target: 'esnext',
    outDir: 'supabase/.temp/workspace-commercial-email',
    emptyOutDir: true,
    lib: {
      entry: resolve('supabase/functions/workspace-commercial-email/index.ts'),
      formats: ['es'],
      fileName: () => 'index.ts',
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
process.stdout.write('Bundle de e-mail comercial gerado localmente.\n');
