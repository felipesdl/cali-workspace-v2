import { z } from 'zod';

const environmentSchema = z.object({
  VITE_DATA_MODE: z.literal('demo').default('demo'),
  VITE_DEMO_MODE: z.literal('true').optional(),
  VITE_API_URL: z.literal('').optional(),
  VITE_SUPABASE_URL: z.literal('').optional(),
});

// eslint-disable-next-line no-restricted-syntax -- Configuração externa não validada; safeParse define o contrato de saída.
export function readEnvironment(input: unknown) {
  const result = environmentSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      'Esta etapa aceita somente dados demonstrativos locais. Revise a configuração do ambiente.',
    );
  }
  return result.data;
}
