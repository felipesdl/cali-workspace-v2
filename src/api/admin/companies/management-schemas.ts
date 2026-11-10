import { z } from 'zod';
import { registerWorkspaceAdhesionSchema } from '../../access/adhesion';
import { companyAccessSchema, companyBasicFieldsSchema } from './schemas';

// Comandos virtuais da composição demonstrativa. Não são contratos RPC hospedados.
export const createCompanySchema = z.strictObject({
  requestId: z.uuid(),
  values: companyBasicFieldsSchema,
});
export const registerCompanyAdhesionSchema = registerWorkspaceAdhesionSchema.extend({
  requestId: z.uuid(),
});
export const companyAccessFieldsSchema = z.strictObject({
  name: z.string().trim().min(1, 'Informe o nome da pessoa.'),
  email: z.string().trim().toLowerCase().pipe(z.email('Informe um e-mail válido.')),
});
const accessSnapshotSchema = companyAccessSchema
  .pick({ name: true, email: true, status: true })
  .strict();
export const addCompanyAccessSchema = z.strictObject({
  requestId: z.uuid(),
  companyId: z.uuid(),
  values: companyAccessFieldsSchema,
});
export const changeCompanyAccessSchema = z.strictObject({
  requestId: z.uuid(),
  companyId: z.uuid(),
  accessId: z.uuid(),
  expected: accessSnapshotSchema,
  values: z.strictObject({
    name: companyAccessFieldsSchema.shape.name,
    status: companyAccessSchema.shape.status,
  }),
});
export const companyAccessEventSchema = z.strictObject({
  id: z.uuid(),
  companyId: z.uuid(),
  accessId: z.uuid(),
  action: z.enum(['authorized', 'renamed', 'revoked', 'reauthorized']),
  previous: accessSnapshotSchema.nullable(),
  current: accessSnapshotSchema,
  recordedBy: z.uuid(),
  recordedAt: z.iso.datetime({ offset: true }),
});
export type CreateCompany = z.input<typeof createCompanySchema>;
export type RegisterCompanyAdhesion = z.input<typeof registerCompanyAdhesionSchema>;
export type AddCompanyAccess = z.input<typeof addCompanyAccessSchema>;
export type ChangeCompanyAccess = z.input<typeof changeCompanyAccessSchema>;
export type CompanyAccessEvent = z.infer<typeof companyAccessEventSchema>;
