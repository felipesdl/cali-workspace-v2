import { AxiosError, type AxiosAdapter } from 'axios';
import {
  companyFilterSchema,
  updateCompanyBasicsSchema,
  type Company,
  type CompanyAccess,
} from '../../api/modules/companies/schemas';

import { companies, accesses } from '../fixtures/companies';

// Endpoints virtuais apenas dos mocks de desenvolvimento; não representam RPCs ou rotas do backend oficial.
export function createCompaniesMockAdapter(): AxiosAdapter {
  const currentCompanies = structuredClone(companies);
  return async (config) => {
    let data: Company[] | CompanyAccess[] | Company;
    let status = 200;
    if (config.method === 'get' && config.url === '/companies') {
      const filters = companyFilterSchema.parse(config.params);
      data = currentCompanies.filter(
        (company) =>
          company.displayName
            .toLocaleLowerCase('pt-BR')
            .includes(filters.q.toLocaleLowerCase('pt-BR')) &&
          (filters.status === 'all' || company.status === filters.status),
      );
    } else {
      const match = /^\/companies\/([^/]+)(\/accesses)?$/.exec(config.url ?? '');
      if (
        !['get', 'patch'].includes(config.method ?? '') ||
        !match ||
        !currentCompanies.some((company) => company.id === match[1])
      ) {
        status = 404;
        const response = {
          config,
          data: { message: 'Empresa não encontrada nesta demonstração.' },
          headers: {},
          status,
          statusText: 'Not Found',
        };
        throw new AxiosError(response.data.message, 'ERR_BAD_REQUEST', config, undefined, response);
      }
      if (config.method === 'patch') {
        const value = updateCompanyBasicsSchema.parse(
          typeof config.data === 'string' ? JSON.parse(config.data) : config.data,
        );
        const company = currentCompanies.find((item) => item.id === match[1]);
        if (
          match[2] ||
          !company ||
          value.companyId !== company.id ||
          company.displayName !== value.expected.displayName ||
          company.legalName !== value.expected.legalName
        )
          throw new Error('A edição não foi confirmada. Recarregue os dados da empresa.');
        Object.assign(company, value.values);
        data = company;
        return { config, data: structuredClone(data), headers: {}, status, statusText: 'OK' };
      }
      data = match[2]
        ? accesses.filter((access) => access.companyId === match[1])
        : currentCompanies.find((company) => company.id === match[1])!;
    }
    return { config, data: structuredClone(data), headers: {}, status, statusText: 'OK' };
  };
}
