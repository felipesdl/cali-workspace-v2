import { z } from 'zod';

// Papéis observados no transporte oficial; Partner não habilita uma área nesta etapa.
export const workspaceRole = {
  Admin: 'admin',
  Client: 'client',
  Partner: 'partner',
} as const;

const emailInput = z.string().trim().toLowerCase().pipe(z.email());
const website = z.string().optional();

export const requestAccessCodeSchema = z.strictObject({
  action: z.literal('request'),
  email: emailInput,
  website,
});

export const verifyAccessCodeSchema = z.strictObject({
  action: z.literal('verify'),
  email: emailInput,
  code: z.string().regex(/^\d{6}$/, 'Informe os seis dígitos do código.'),
  website,
});

const accessErrorSchema = z.strictObject({ error: z.string().min(1) });

export const requestAccessCodeResponseSchema = z.union([
  z.strictObject({ ok: z.literal(true), challenge: z.literal('code').optional() }),
  accessErrorSchema,
]);

export const verifyAccessCodeResponseSchema = z.union([
  z.strictObject({
    ok: z.literal(true),
    token_hash: z.string().min(1),
    role: z.enum(workspaceRole),
  }),
  accessErrorSchema,
]);

// Projeção mínima de leitura planejada; parse não comprova autorização nem sessão.
export const workspaceProfileRecordSchema = z.strictObject({
  id: z.uuid(),
  company_id: z.uuid().nullable(),
  role: z.enum(workspaceRole),
  active: z.boolean(),
});

export const termsAcceptanceRecordSchema = z.strictObject({
  user_id: z.uuid(),
  version: z.string().min(1).max(40),
  accepted_at: z.iso.datetime({ offset: true }),
});

export type RequestAccessCode = z.infer<typeof requestAccessCodeSchema>;
export type VerifyAccessCode = z.infer<typeof verifyAccessCodeSchema>;
export type RequestAccessCodeResponse = z.infer<typeof requestAccessCodeResponseSchema>;
export type VerifyAccessCodeResponse = z.infer<typeof verifyAccessCodeResponseSchema>;
export type WorkspaceProfileRecord = z.infer<typeof workspaceProfileRecordSchema>;
export type TermsAcceptanceRecord = z.infer<typeof termsAcceptanceRecordSchema>;
