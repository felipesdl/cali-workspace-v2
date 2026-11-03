import { normalizeCompanyFilters, type CompanyFilters } from './schemas';

export const companyQueryKey = {
  Workspace: 'workspace',
  Companies: 'companies',
  List: 'list',
  Detail: 'detail',
  Accesses: 'accesses',
  Adhesions: 'adhesions',
  AccessHistory: 'access-history',
  Registration: 'registration',
  RegistrationHistory: 'registration-history',
  Administration: 'administration',
  AdministrationHistory: 'administration-history',
} as const;

export const companyKeys = {
  all: (actorId: string) =>
    [companyQueryKey.Workspace, actorId, companyQueryKey.Companies] as const,
  list: (actorId: string, filters: CompanyFilters) =>
    [...companyKeys.all(actorId), companyQueryKey.List, normalizeCompanyFilters(filters)] as const,
  detail: (actorId: string, companyId: string) =>
    [...companyKeys.all(actorId), companyId, companyQueryKey.Detail] as const,
  adhesions: (actorId: string, companyId: string) =>
    [...companyKeys.all(actorId), companyId, companyQueryKey.Adhesions] as const,
  accessHistory: (actorId: string, companyId: string) =>
    [...companyKeys.all(actorId), companyId, companyQueryKey.AccessHistory] as const,
  registration: (actorId: string, companyId: string) =>
    [...companyKeys.all(actorId), companyId, companyQueryKey.Registration] as const,
  registrationHistory: (actorId: string, companyId: string) =>
    [...companyKeys.all(actorId), companyId, companyQueryKey.RegistrationHistory] as const,
  administration: (actorId: string, companyId: string) =>
    [...companyKeys.all(actorId), companyId, companyQueryKey.Administration] as const,
  administrationHistory: (actorId: string, companyId: string) =>
    [...companyKeys.all(actorId), companyId, companyQueryKey.AdministrationHistory] as const,
  accesses: (actorId: string, companyId: string) =>
    [...companyKeys.all(actorId), companyId, companyQueryKey.Accesses] as const,
};
