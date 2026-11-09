import { z } from 'zod';
import { companyStatus } from './schemas';

// Projeções mínimas planejadas sobre tabelas existentes, sem fingir tipos gerados do banco.
export const companyIdentityRecordSchema = z.strictObject({
  id: z.uuid(),
  display_name: z.string(),
  legal_name: z.string(),
  status: z.enum(companyStatus),
});

export const clientInviteIdentityRecordSchema = z.strictObject({
  id: z.uuid(),
  company_id: z.uuid(),
  email: z.email(),
  full_name: z.string(),
  active: z.boolean(),
  platform_access: z.boolean(),
  // Metadado legado de contato. Nunca implica maior permissão na V2.
  is_primary: z.boolean(),
});

export type CompanyIdentityRecord = z.infer<typeof companyIdentityRecordSchema>;
export type ClientInviteIdentityRecord = z.infer<typeof clientInviteIdentityRecordSchema>;
