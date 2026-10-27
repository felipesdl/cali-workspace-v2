import { AxiosError, type AxiosAdapter } from 'axios';
import {
  companyFilterSchema,
  type Company,
  type CompanyAccess,
} from '../../api/modules/companies/schemas';

import { companies, accesses } from '../fixtures/companies';

// Endpoints virtuais apenas dos mocks de desenvolvimento; não representam RPCs ou rotas do backend oficial.
export function createCompaniesMockAdapter(): AxiosAdapter {
  return async (config) => {
    let data: Company[] | CompanyAccess[] | Company;
    let status = 200;
    if (config.method === 'get' && config.url === '/companies') {
      const filters = companyFilterSchema.parse(config.params);
      data = companies.filter(
        (company) =>
          company.displayName
            .toLocaleLowerCase('pt-BR')
            .includes(filters.q.toLocaleLowerCase('pt-BR')) &&
          (filters.status === 'all' || company.status === filters.status),
      );
    } else {
      const match = /^\/companies\/([^/]+)(\/accesses)?$/.exec(config.url ?? '');
      if (
        config.method !== 'get' ||
        !match ||
        !companies.some((company) => company.id === match[1])
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
      data = match[2]
        ? accesses.filter((access) => access.companyId === match[1])
        : companies.find((company) => company.id === match[1])!;
    }
    return { config, data: structuredClone(data), headers: {}, status, statusText: 'OK' };
  };
}
