import { z } from 'zod';

const caliMapBackend = 'https://kqtbfeeqbcllwvlkbrkq.supabase.co';
const caliProductionOrigin = 'https://app.calirh.com';

const environmentSchema = z
  .object({
    VITE_DATA_MODE: z.enum(['demo', 'supabase']).optional(),
    VITE_DEMO_MODE: z.enum(['true', 'false']).optional(),
    VITE_API_URL: z.literal('').optional(),
    VITE_SUPABASE_URL: z.string().optional(),
    VITE_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
    VITE_CALI_RELEASE_CORE: z.enum(['true', 'false']).optional(),
  })
  .transform((input, context) => {
    const configured = Boolean(input.VITE_SUPABASE_URL || input.VITE_SUPABASE_PUBLISHABLE_KEY);
    const mode = input.VITE_DATA_MODE ?? (configured ? 'supabase' : 'demo');
    const releaseCore = input.VITE_CALI_RELEASE_CORE === 'true';
    if (mode === 'demo' && (configured || input.VITE_DEMO_MODE === 'false' || releaseCore)) {
      context.addIssue({ code: 'custom', message: 'Configuração demonstrativa contraditória.' });
      return z.NEVER;
    }
    if (mode === 'demo') return { mode, VITE_DATA_MODE: mode } as const;
    const url = z.url().safeParse(input.VITE_SUPABASE_URL);
    const key = input.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url.success || !key?.startsWith('sb_publishable_') || input.VITE_DEMO_MODE === 'true') {
      context.addIssue({
        code: 'custom',
        message: 'URL e chave pública Supabase são obrigatórias.',
      });
      return z.NEVER;
    }
    const target = new URL(url.data);
    if (
      target.protocol !== 'https:' ||
      !/^[a-z0-9-]+\.supabase\.co$/.test(target.hostname) ||
      target.pathname !== '/' ||
      target.search ||
      target.hash ||
      target.username ||
      target.password ||
      target.port
    ) {
      context.addIssue({ code: 'custom', message: 'URL Supabase hospedada inválida.' });
      return z.NEVER;
    }
    if (releaseCore && target.origin !== caliMapBackend) {
      context.addIssue({ code: 'custom', message: 'A configuração de release exige o CALI MAPA.' });
      return z.NEVER;
    }
    return {
      mode,
      VITE_DATA_MODE: mode,
      url: target.origin,
      publishableKey: key,
      releaseCore,
    } as const;
  });

// eslint-disable-next-line no-restricted-syntax -- Entrada externa; o schema valida antes de compor os serviços.
export function readEnvironment(input: unknown) {
  const result = environmentSchema.safeParse(input);
  if (!result.success)
    throw new Error(
      'Configuração de ambiente inválida. Revise o modo de dados, a URL e a chave pública.',
    );
  return result.data;
}

export type AppEnvironment = z.infer<typeof environmentSchema>;

export function resolveCaliRuntime(
  environment: AppEnvironment,
  development: boolean,
  origin: string,
) {
  const isCaliMap = environment.mode === 'supabase' && environment.url === caliMapBackend;
  return {
    pilot: isCaliMap && development,
    releaseCore:
      isCaliMap && !development && environment.releaseCore && origin === caliProductionOrigin,
  };
}
