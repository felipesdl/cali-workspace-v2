import { type AxiosInstance } from 'axios';
import { z } from 'zod';
import {
  companyAccessSchema,
  companySchema,
  normalizeCompanyFilters,
  type CompanyFilters,
} from './schemas';

export function createCompaniesService(client: AxiosInstance) {
  return {
    async detail(companyId: string, signal?: AbortSignal) {
      const id = z.uuid().parse(companyId);
      // eslint-disable-next-line no-restricted-syntax -- Resposta bruta; companySchema valida antes de retornar ao domínio.
      const response = await client.get<unknown>(`/companies/${id}`, { signal });
      const company = companySchema.parse(response.data);
      if (company.id !== id) throw new Error('Resposta incompatível com a empresa selecionada.');
      return company;
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
