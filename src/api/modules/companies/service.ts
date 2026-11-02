import { type AxiosInstance } from 'axios';
import { z } from 'zod';
import { createCompanyManagement, type CompanyManagement } from './management';
import {
  companyAccessSchema,
  companySchema,
  companyDetailsSchema,
  updateCompanyBasicsSchema,
  type UpdateCompanyBasics,
  normalizeCompanyFilters,
  type CompanyFilters,
  type Company,
  type CompanyDetails,
  type CompanyAccess,
} from './schemas';

export function createCompaniesService(client: AxiosInstance): CompaniesService {
  return {
    management: createCompanyManagement(client),
    async detail(companyId: string, signal?: AbortSignal) {
      const id = z.uuid().parse(companyId);
      // eslint-disable-next-line no-restricted-syntax -- Resposta bruta; companyDetailsSchema valida antes de retornar ao domínio.
      const response = await client.get<unknown>(`/companies/${id}`, { signal });
      const company = companyDetailsSchema.parse(response.data);
      if (company.id !== id) throw new Error('Resposta incompatível com a empresa selecionada.');
      return company;
    },
    async updateBasics(input: UpdateCompanyBasics) {
      const value = updateCompanyBasicsSchema.parse(input);
      // eslint-disable-next-line no-restricted-syntax -- Resposta bruta validada antes de retornar ao domínio.
      const response = await client.patch<unknown>(`/companies/${value.companyId}`, value);
      const result = companyDetailsSchema.parse(response.data);
      if (
        result.id !== value.companyId ||
        result.displayName !== value.values.displayName ||
        result.legalName !== value.values.legalName
      )
        throw new Error('Não foi possível confirmar a alteração da empresa. Atualize os dados.');
      return result;
    },
    async list(filters: CompanyFilters, signal?: AbortSignal) {
      // eslint-disable-next-line no-restricted-syntax -- Resposta bruta; o array é validado por Zod antes do consumo.
      const response = await client.get<unknown>('/companies', {
        params: normalizeCompanyFilters(filters),
        signal,
      });
      return z.array(companySchema).parse(response.data);
    },
    async accesses(companyId: string, signal?: AbortSignal) {
      const id = z.uuid().parse(companyId);
      // eslint-disable-next-line no-restricted-syntax -- Resposta bruta; schema e vínculo da empresa são conferidos abaixo.
      const response = await client.get<unknown>(`/companies/${id}/accesses`, { signal });
      const result = z.array(companyAccessSchema).parse(response.data);
      if (result.some((access) => access.companyId !== id)) {
        throw new Error('Resposta de acessos incompatível com a empresa selecionada.');
      }
      return result;
    },
  };
}
export type CompaniesService = {
  management: CompanyManagement | null;
  detail: (companyId: string, signal?: AbortSignal) => Promise<CompanyDetails>;
  list: (filters: CompanyFilters, signal?: AbortSignal) => Promise<Company[]>;
  accesses: (companyId: string, signal?: AbortSignal) => Promise<CompanyAccess[]>;
  updateBasics: (input: UpdateCompanyBasics) => Promise<CompanyDetails>;
};
