import { resolve } from 'node:path';
import { build } from 'vite';

for (const service of [
  'workspace-access-preview',
  'cali-forms-confirmation',
  'google-drive-oauth',
  'workspace-agenda-calendar',
]) {
  await build({
    configFile: false,
    logLevel: 'error',
    build: {
      target: 'esnext',
      minify: true,
      outDir: resolve('supabase/.temp', service),
      emptyOutDir: false,
      lib: {
        entry: resolve('supabase/functions', service, 'index.ts'),
        formats: ['es'],
        fileName: () => 'index.ts',
      },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  process.stdout.write(`Bundle ${service} gerado localmente.\n`);
}
