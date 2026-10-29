import { z } from 'zod';
import { workspaceProfileRecordSchema } from './schemas.ts';
import { companyStatus } from '../companies/schemas.ts';

export const currentTermsSchema = z.strictObject({
  version: z.string().min(1).max(40),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  title: z.string().min(1),
  content: z.string().min(1),
});
export const acceptCurrentTermsSchema = currentTermsSchema.pick({
  version: true,
  contentHash: true,
});
export const workspaceAccessStateSchema = z
  .strictObject({
    status: z.enum([
      'signed_out',
      'blocked',
      'mfa_required',
      'terms_unavailable',
      'terms_required',
      'ready',
    ]),
    profile: workspaceProfileRecordSchema.nullable(),
    companyStatus: z.enum(companyStatus).nullable(),
    terms: currentTermsSchema.nullable(),
    termsAccepted: z.boolean(),
  })
  .refine((value) => {
    if (value.status !== 'ready') return true;
    const profile = value.profile;
    return Boolean(
      profile?.active &&
      value.terms &&
      value.termsAccepted &&
      (profile.role === 'admin' ||
        (profile.role === 'client' &&
          profile.company_id &&
          (value.companyStatus === 'active' || value.companyStatus === 'paused'))),
    );
  }, 'Estado de acesso inconsistente.');

export type CurrentTerms = z.infer<typeof currentTermsSchema>;
export type WorkspaceAccessState = z.infer<typeof workspaceAccessStateSchema>;
