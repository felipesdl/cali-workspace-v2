import { z } from 'zod';

export const companyStatus = {
  Active: 'active',
  Paused: 'paused',
  Blocked: 'blocked',
  Closed: 'closed',
  Archived: 'archived',
} as const;

export const companySchema = z.object({
  id: z.uuid(),
  displayName: z.string().min(1),
  plan: z.enum(['partner', 'full']),
  status: z.enum(companyStatus),
  createdOn: z.iso.date(),
});

export const companyAccessSchema = z.object({
  id: z.uuid(),
  companyId: z.uuid(),
  name: z.string().min(1),
  email: z.email(),
  status: z.enum(['active', 'revoked']),
  invitedOn: z.iso.date(),
});

export const companyFilterSchema = z.object({
  q: z.string().trim().max(120, 'Use até 120 caracteres na busca.'),
  status: z.enum(['all', ...Object.values(companyStatus)]),
});

export const companySearchSchema = z.object({
  q: companyFilterSchema.shape.q.catch(''),
  status: companyFilterSchema.shape.status.catch('all'),
  companyId: z.uuid().optional().catch(undefined),
});

export type Company = z.infer<typeof companySchema>;
export type CompanyAccess = z.infer<typeof companyAccessSchema>;
export type CompanyFilters = z.infer<typeof companyFilterSchema>;
export type CompanySearch = z.infer<typeof companySearchSchema>;

export function normalizeCompanyFilters(filters: CompanyFilters): CompanyFilters {
  const parsed = companyFilterSchema.parse(filters);
  return { ...parsed, q: parsed.q.toLocaleLowerCase('pt-BR') };
}
