import { resolve } from 'node:path';
import { build } from 'vite';

for (const worker of [
  'workspace-commercial-email',
  'workspace-admin-digest-pilot',
  'workspace-mapa-email-pilot',
]) {
  await build({
    configFile: false,
    logLevel: 'warn',
    build: {
      target: 'esnext',
      outDir: 'supabase/.temp/' + worker,
      emptyOutDir: true,
      lib: {
        entry: resolve('supabase/functions', worker, 'index.ts'),
        formats: ['es'],
        fileName: () => 'index.ts',
      },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  process.stdout.write('Bundle gerado localmente para ' + worker + '.\n');
}
