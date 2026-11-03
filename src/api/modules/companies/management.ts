import { createAdhesionEvidence } from './evidence';
import { createCompanyDocuments } from './documents';
import { createCompanyRegistration } from './registration';
import { createCompanyAdministration } from './administration';
import { type AxiosInstance } from 'axios';
import { z } from 'zod';
import { workspaceAdhesionRecordSchema } from '../access/adhesion';
import { companyAccessSchema, companyDetailsSchema } from './schemas';
import {
  createCompanySchema,
  registerCompanyAdhesionSchema,
  addCompanyAccessSchema,
  changeCompanyAccessSchema,
  companyAccessEventSchema,
  type CreateCompany,
  type RegisterCompanyAdhesion,
  type AddCompanyAccess,
  type ChangeCompanyAccess,
} from './management-schemas';

// Apenas transporte virtual em memória. A composição hospedada não instancia este serviço.
export function createCompanyManagement(client: AxiosInstance) {
  return {
    documents: createCompanyDocuments(client),
    evidence: createAdhesionEvidence(client),
    administration: createCompanyAdministration(client),
    registration: createCompanyRegistration(client),
    async create(input: CreateCompany) {
      const value = createCompanySchema.parse(input);
      // eslint-disable-next-line no-restricted-syntax -- Entrada de transporte validada por Zod.
      const response = await client.post<unknown>('/companies', value);
      const result = companyDetailsSchema.parse(response.data);
      if (
        result.displayName !== value.values.displayName ||
        result.legalName !== (value.values.legalName || value.values.displayName)
      )
        throw new Error('Não foi possível confirmar o cadastro.');
      return result;
    },
    async adhesions(companyId: string, signal?: AbortSignal) {
      const id = z.uuid().parse(companyId);
      // eslint-disable-next-line no-restricted-syntax -- Entrada de transporte validada por Zod e vínculo.
      const response = await client.get<unknown>(`/companies/${id}/adhesions`, { signal });
      const result = z.array(workspaceAdhesionRecordSchema).parse(response.data);
      if (result.some((item) => item.companyId !== id))
        throw new Error('Referências de outra empresa recusadas.');
      return result;
    },
    async registerAdhesion(input: RegisterCompanyAdhesion) {
      const value = registerCompanyAdhesionSchema.parse(input);
      // eslint-disable-next-line no-restricted-syntax -- Entrada de transporte validada por Zod e vínculo.
      const response = await client.post<unknown>(`/companies/${value.companyId}/adhesions`, value);
      const result = workspaceAdhesionRecordSchema.parse(response.data);
      if (
        result.companyId !== value.companyId ||
        result.evidenceReference !== value.evidenceReference
      )
        throw new Error('Não foi possível confirmar o registro da adesão.');
      return result;
    },
    async addAccess(input: AddCompanyAccess) {
      const value = addCompanyAccessSchema.parse(input);
      // eslint-disable-next-line no-restricted-syntax -- Entrada de transporte validada por Zod e vínculo.
      const response = await client.post<unknown>(`/companies/${value.companyId}/accesses`, value);
      const result = companyAccessSchema.parse(response.data);
      if (
        result.companyId !== value.companyId ||
        result.name !== value.values.name ||
        result.email !== value.values.email ||
        result.status !== 'active'
      )
        throw new Error('Não foi possível confirmar a autorização.');
      return result;
    },
    async changeAccess(input: ChangeCompanyAccess) {
      const value = changeCompanyAccessSchema.parse(input);
      // eslint-disable-next-line no-restricted-syntax -- Entrada de transporte validada por Zod e vínculo.
      const response = await client.patch<unknown>(
        `/companies/${value.companyId}/accesses/${value.accessId}`,
        value,
      );
      const result = companyAccessSchema.parse(response.data);
      if (
        result.companyId !== value.companyId ||
        result.id !== value.accessId ||
        result.email !== value.expected.email ||
        result.name !== value.values.name ||
        result.status !== value.values.status
      )
        throw new Error('Não foi possível confirmar a alteração do acesso.');
      return result;
    },
    async accessHistory(companyId: string, signal?: AbortSignal) {
      const id = z.uuid().parse(companyId);
      // eslint-disable-next-line no-restricted-syntax -- Entrada de transporte validada por Zod e vínculo.
      const response = await client.get<unknown>(`/companies/${id}/access-history`, { signal });
      const result = z.array(companyAccessEventSchema).parse(response.data);
      if (result.some((item) => item.companyId !== id))
        throw new Error('Histórico de outra empresa recusado.');
      return result;
    },
  };
}
export type CompanyManagement = ReturnType<typeof createCompanyManagement>;
