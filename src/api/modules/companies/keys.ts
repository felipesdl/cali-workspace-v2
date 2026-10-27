import { normalizeCompanyFilters, type CompanyFilters } from './schemas';

export const companyQueryKey = {
  Workspace: 'workspace',
  Companies: 'companies',
  List: 'list',
  Detail: 'detail',
  Accesses: 'accesses',
} as const;

export const companyKeys = {
  all: (actorId: string) =>
    [companyQueryKey.Workspace, actorId, companyQueryKey.Companies] as const,
  list: (actorId: string, filters: CompanyFilters) =>
    [...companyKeys.all(actorId), companyQueryKey.List, normalizeCompanyFilters(filters)] as const,
  detail: (actorId: string, companyId: string) =>
    [...companyKeys.all(actorId), companyId, companyQueryKey.Detail] as const,
  accesses: (actorId: string, companyId: string) =>
    [...companyKeys.all(actorId), companyId, companyQueryKey.Accesses] as const,
};
