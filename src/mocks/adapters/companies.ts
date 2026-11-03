import { createAdministrationState } from './company-administration';
import {
  updateAdministrationSchema,
  type CompanyAdministration,
  type AdministrationEvent,
} from '../../api/modules/companies/administration-schemas';
import { AxiosError, type AxiosAdapter } from 'axios';
import {
  companyFilterSchema,
  updateCompanyBasicsSchema,
  type Company,
  type CompanyDetails,
  type CompanyAccess,
} from '../../api/modules/companies/schemas';
import {
  createCompanySchema,
  registerCompanyAdhesionSchema,
  addCompanyAccessSchema,
  changeCompanyAccessSchema,
  type CompanyAccessEvent,
} from '../../api/modules/companies/management-schemas';
import { type WorkspaceAdhesionRecord } from '../../api/modules/access/adhesion';
import { companies, accesses } from '../fixtures/companies';

type ManagementResult =
  CompanyDetails | WorkspaceAdhesionRecord | CompanyAccess | CompanyAdministration;
const demoAdmin = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

// Transações virtuais síncronas: nunca representam RLS/RPC ou persistência hospedadas.
export function createCompaniesMockAdapter(): AxiosAdapter {
  const administration = createAdministrationState();
  const currentCompanies = structuredClone(companies);
  const currentAccesses = structuredClone(accesses);
  const adhesions: WorkspaceAdhesionRecord[] = [];
  const history: CompanyAccessEvent[] = [];
  const requests = new Map<string, { signature: string; result: ManagementResult }>();
  function perform(requestId: string, signature: string, operation: () => ManagementResult) {
    const previous = requests.get(requestId);
    if (previous) {
      if (previous.signature !== signature)
        throw new Error(
          'Esta solicitação já foi usada com outros dados. Recarregue antes de continuar.',
        );
      return previous.result;
    }
    const result = operation();
    requests.set(requestId, { signature, result: structuredClone(result) });
    return result;
  }
  function requireAdhesion(company: CompanyDetails) {
    if (!adhesions.some((item) => item.companyId === company.id))
      throw new Error('Registre a referência da adesão antes de autorizar acessos.');
    if (!['active', 'paused'].includes(company.status))
      throw new Error('Esta empresa não está disponível para autorizar acessos.');
  }
  function requireSlot(companyId: string, exceptId?: string) {
    if (
      currentAccesses.filter(
        (item) => item.companyId === companyId && item.id !== exceptId && item.status === 'active',
      ).length >= 4
    )
      throw new Error(
        'A empresa já possui quatro acessos autorizados. Revogue um deles antes de continuar.',
      );
  }
  function recordAccess(current: CompanyAccess, previous: CompanyAccess | null) {
    if (previous && previous.name === current.name && previous.status === current.status) return;
    const action = !previous
      ? 'authorized'
      : previous.status !== current.status
        ? current.status === 'active'
          ? 'reauthorized'
          : 'revoked'
        : 'renamed';
    const snapshot = (item: CompanyAccess) => ({
      name: item.name,
      email: item.email,
      status: item.status,
    });
    history.push({
      id: crypto.randomUUID(),
      companyId: current.companyId,
      accessId: current.id,
      action,
      previous: previous ? snapshot(previous) : null,
      current: snapshot(current),
      recordedBy: demoAdmin,
      recordedAt: new Date().toISOString(),
    });
  }
  return async (config) => {
    const respond = (
      data:
        | Company[]
        | ManagementResult
        | CompanyAccess[]
        | WorkspaceAdhesionRecord[]
        | CompanyAccessEvent[]
        | AdministrationEvent[],
    ) => ({ config, data: structuredClone(data), headers: {}, status: 200, statusText: 'OK' });
    const body = () => (typeof config.data === 'string' ? JSON.parse(config.data) : config.data);
    const signature = (value: object) => JSON.stringify([config.method, config.url, value]);
    if (config.method === 'get' && config.url === '/companies') {
      const filters = companyFilterSchema.parse(config.params);
      return respond(
        currentCompanies.filter(
          (company) =>
            company.displayName
              .toLocaleLowerCase('pt-BR')
              .includes(filters.q.toLocaleLowerCase('pt-BR')) &&
            (filters.status === 'all' || company.status === filters.status),
        ),
      );
    }
    if (config.method === 'post' && config.url === '/companies') {
      const value = createCompanySchema.parse(body());
      return respond(
        perform(value.requestId, signature(value), () => {
          const company: CompanyDetails = {
            id: crypto.randomUUID(),
            displayName: value.values.displayName,
            legalName: value.values.legalName || value.values.displayName,
            plan: null,
            status: 'active',
            createdOn: new Date().toISOString().slice(0, 10),
          };
          currentCompanies.push(company);
          return company;
        }),
      );
    }
    const match =
      /^\/companies\/([^/]+)(?:\/(adhesions|accesses|access-history|administration|administration-history)(?:\/([^/]+))?)?$/.exec(
        config.url ?? '',
      );
    const company = currentCompanies.find((item) => item.id === match?.[1]);
    if (!match || !company) {
      const response = {
        config,
        data: { message: 'Empresa não encontrada nesta demonstração.' },
        headers: {},
        status: 404,
        statusText: 'Not Found',
      };
      throw new AxiosError(response.data.message, 'ERR_BAD_REQUEST', config, undefined, response);
    }
    const resource = match[2];
    if (config.method === 'get' && !match[3]) {
      if (!resource) return respond(company);
      if (resource === 'accesses')
        return respond(currentAccesses.filter((item) => item.companyId === company.id));
      if (resource === 'adhesions')
        return respond(adhesions.filter((item) => item.companyId === company.id));
      if (resource === 'administration') return respond(administration.read(company.id));
      if (resource === 'administration-history') return respond(administration.history(company.id));
      if (resource === 'access-history')
        return respond(history.filter((item) => item.companyId === company.id));
    }
    if (config.method === 'patch' && resource === 'administration' && !match[3]) {
      const value = updateAdministrationSchema.parse(body());
      if (value.companyId !== company.id) throw new Error('Empresa incompatível com a ficha.');
      return respond(
        perform(value.requestId, signature(value), () => administration.update(value)),
      );
    }
    if (config.method === 'patch' && !resource) {
      const value = updateCompanyBasicsSchema.parse(body());
      if (
        value.companyId !== company.id ||
        company.displayName !== value.expected.displayName ||
        company.legalName !== value.expected.legalName
      )
        throw new Error('A edição não foi confirmada. Recarregue os dados da empresa.');
      Object.assign(company, value.values);
      return respond(company);
    }
    if (config.method === 'post' && resource === 'adhesions' && !match[3]) {
      const value = registerCompanyAdhesionSchema.parse(body());
      if (value.companyId !== company.id) throw new Error('Empresa incompatível com a referência.');
      return respond(
        perform(value.requestId, signature(value), () => {
          const record: WorkspaceAdhesionRecord = {
            id: crypto.randomUUID(),
            companyId: company.id,
            evidenceReference: value.evidenceReference,
            recordedBy: demoAdmin,
            recordedAt: new Date().toISOString(),
          };
          adhesions.push(record);
          return record;
        }),
      );
    }
    if (config.method === 'post' && resource === 'accesses' && !match[3]) {
      const value = addCompanyAccessSchema.parse(body());
      if (value.companyId !== company.id) throw new Error('Empresa incompatível com o acesso.');
      return respond(
        perform(value.requestId, signature(value), () => {
          requireAdhesion(company);
          requireSlot(company.id);
          if (
            currentAccesses.some(
              (item) =>
                item.companyId === company.id && item.email.toLowerCase() === value.values.email,
            )
          )
            throw new Error(
              'Este e-mail já possui um registro nesta empresa. Revise o acesso existente.',
            );
          const access: CompanyAccess = {
            id: crypto.randomUUID(),
            companyId: company.id,
            ...value.values,
            status: 'active',
            invitedOn: null,
          };
          currentAccesses.push(access);
          recordAccess(access, null);
          return access;
        }),
      );
    }
    if (config.method === 'patch' && resource === 'accesses' && match[3]) {
      const value = changeCompanyAccessSchema.parse(body());
      if (value.companyId !== company.id || value.accessId !== match[3])
        throw new Error('Acesso incompatível com a empresa.');
      return respond(
        perform(value.requestId, signature(value), () => {
          const access = currentAccesses.find(
            (item) => item.companyId === company.id && item.id === value.accessId,
          );
          if (
            !access ||
            access.name !== value.expected.name ||
            access.email !== value.expected.email ||
            access.status !== value.expected.status
          )
            throw new Error('O acesso mudou. Recarregue os dados antes de editar.');
          if (value.values.status === 'active' && access.status !== 'active') {
            requireAdhesion(company);
            requireSlot(company.id, access.id);
          }
          const previous = structuredClone(access);
          Object.assign(access, value.values);
          recordAccess(access, previous);
          return access;
        }),
      );
    }
    throw new Error('Operação indisponível nesta demonstração.');
  };
}
