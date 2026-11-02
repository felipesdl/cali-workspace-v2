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
  plan: z.enum(['partner', 'full', 'build']).nullable(),
  status: z.enum(companyStatus),
  createdOn: z.iso.date(),
});

// Detalhe separado da lista; valores originais preservados para comparação atômica.
export const companyDetailsSchema = companySchema.extend({ legalName: z.string() });
const companyBasicSnapshotSchema = z.strictObject({
  displayName: z.string(),
  legalName: z.string(),
});
export const companyBasicFieldsSchema = z.strictObject({
  displayName: z.string().trim().min(1, 'Informe o nome da empresa.'),
  legalName: z.string().trim(),
});
export const updateCompanyBasicsSchema = z.strictObject({
  companyId: z.uuid(),
  expected: companyBasicSnapshotSchema,
  values: companyBasicFieldsSchema.transform((value) => ({
    displayName: value.displayName,
    legalName: value.legalName || value.displayName,
  })),
});
export type CompanyDetails = z.infer<typeof companyDetailsSchema>;
export type UpdateCompanyBasics = z.input<typeof updateCompanyBasicsSchema>;

export const companyAccessSchema = z.object({
  id: z.uuid(),
  companyId: z.uuid(),
  name: z.string().min(1),
  email: z.email(),
  status: z.enum(['active', 'revoked']),
  invitedOn: z.iso.date().nullable(),
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
