import { describe, expect, it } from 'vitest';
import { createCompaniesService } from '../src/api/modules/companies/service';
import { createCompaniesMockAdapter } from '../src/mocks/adapters/companies';
import { createMockHttpClient } from '../src/mocks/http/client';
import { mockCompanyIds } from '../src/mocks/fixtures/companies';
import { createStaticResponseAdapter } from './mocks/http';
import { type CompanyAccess } from '../src/api/modules/companies/schemas';
import { type ChangeCompanyAccess } from '../src/api/modules/companies/management-schemas';

function setup() {
  const service = createCompaniesService(createMockHttpClient(createCompaniesMockAdapter()));
  const management = service.management;
  if (!management) throw new Error('Composição de teste sem gestão.');
  return { service, management };
}
async function newCompany() {
  const { service, management } = setup();
  const request = {
    requestId: crypto.randomUUID(),
    values: { displayName: 'Empresa teste', legalName: '' },
  };
  const company = await management.create(request);
  const register = async () => {
    const reference = await management.registerAdhesion({
      requestId: crypto.randomUUID(),
      companyId: company.id,
      evidenceReference: 'Formalização sintética 01',
    });
    await management.evidence.confirm({
      requestId: crypto.randomUUID(),
      companyId: company.id,
      adhesionId: reference.id,
      documentVersionId: null,
      reviewNote: 'Conferência externa sintética',
      confirmed: true,
    });
    return reference;
  };
  const add = (number: number) =>
    management.addAccess({
      requestId: crypto.randomUUID(),
      companyId: company.id,
      values: { name: `Pessoa ${number}`, email: `pessoa${number}@example.test` },
    });
  return { service, management, company, request, register, add };
}
function change(access: CompanyAccess, status: CompanyAccess['status']): ChangeCompanyAccess {
  return {
    requestId: crypto.randomUUID(),
    companyId: access.companyId,
    accessId: access.id,
    expected: { name: access.name, email: access.email, status: access.status },
    values: { name: access.name, status },
  };
}
describe('gestão demonstrativa de empresas, adesão e quatro acessos', () => {
  it('cria identidade sem acessos/perfil, protege repetição e mantém estado por instância', async () => {
    const { company, management, service, request } = await newCompany();
    expect(company).toMatchObject({
      displayName: 'Empresa teste',
      legalName: 'Empresa teste',
      plan: null,
    });
    expect(await management.create(request)).toEqual(company);
    expect(await service.list({ q: 'Empresa teste', status: 'all' })).toHaveLength(1);
    expect(await service.accesses(company.id)).toEqual([]);
    expect(await management.adhesions(company.id)).toEqual([]);
    await expect(
      management.create({ ...request, values: { displayName: 'Outra', legalName: '' } }),
    ).rejects.toThrow('outros dados');
    await expect(setup().service.detail(company.id)).rejects.toThrow('Empresa não encontrada');
  });
  it('adesão tem autoria/instante da fronteira, preserva registros e bloqueia acesso sem referência', async () => {
    const { management, company, add, register } = await newCompany();
    await expect(add(1)).rejects.toThrow('referência da adesão');
    const input = {
      requestId: crypto.randomUUID(),
      companyId: company.id,
      evidenceReference: '  Referência A  ',
    };
    const first = await management.registerAdhesion(input);
    expect(first.evidenceReference).toBe('Referência A');
    expect(first.recordedBy).toMatch(/^[a-f0-9-]{36}$/);
    expect(Number.isFinite(Date.parse(first.recordedAt))).toBe(true);
    expect(await management.registerAdhesion(input)).toEqual(first);
    await expect(add(1)).rejects.toThrow('comprovação administrativa');
    await register();
    expect(await management.adhesions(company.id)).toHaveLength(2);
    const forged = { ...input, requestId: crypto.randomUUID(), recordedBy: crypto.randomUUID() };
    await expect(management.registerAdhesion(forged)).rejects.toThrow();
    expect(await add(1)).toMatchObject({ status: 'active', invitedOn: null });
  });
  it('cinco solicitações concorrentes não excedem quatro autorizações', async () => {
    const { service, company, register, add } = await newCompany();
    await register();
    const results = await Promise.allSettled([1, 2, 3, 4, 5].map(add));
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(4);
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(1);
    expect(
      (await service.accesses(company.id)).filter((item) => item.status === 'active'),
    ).toHaveLength(4);
  });
  it('revogar um preserva demais; reautorização é explícita e respeita vagas/histórico', async () => {
    const { service, management, company, register, add } = await newCompany();
    await register();
    const grants = await Promise.all([1, 2, 3, 4].map(add));
    const request = change(grants[0], 'revoked');
    const revoked = await management.changeAccess(request);
    expect(await management.changeAccess(request)).toEqual(revoked);
    expect((await service.accesses(company.id)).slice(1)).toEqual(grants.slice(1));
    await add(5);
    await expect(management.changeAccess(change(revoked, 'active'))).rejects.toThrow(
      'quatro acessos',
    );
    await management.changeAccess(change(grants[1], 'revoked'));
    await management.changeAccess(change(revoked, 'active'));
    const history = await management.accessHistory(company.id);
    expect(history.filter((item) => item.action === 'revoked')).toHaveLength(2);
    expect(history.filter((item) => item.action === 'reauthorized')).toHaveLength(1);
    expect(await service.accesses(company.id)).toHaveLength(5);
  });
  it('não duplica e-mail normalizado, não aceita preimagem antiga e não altera vínculo/e-mail', async () => {
    const { service, management, company, register, add } = await newCompany();
    await register();
    const original = await add(1);
    await expect(
      management.addAccess({
        requestId: crypto.randomUUID(),
        companyId: company.id,
        values: { name: 'Duplicado', email: ' PESSOA1@example.test ' },
      }),
    ).rejects.toThrow('já possui');
    const request = {
      ...change(original, 'active'),
      values: { name: 'Nome corrigido', status: original.status },
    };
    await management.changeAccess(request);
    await expect(management.changeAccess(change(original, 'revoked'))).rejects.toThrow(
      'acesso mudou',
    );
    await expect(
      management.changeAccess({ ...change(original, 'revoked'), companyId: mockCompanyIds.Norte }),
    ).rejects.toThrow('acesso mudou');
    expect((await service.accesses(company.id))[0]).toMatchObject({
      name: 'Nome corrigido',
      email: original.email,
      companyId: company.id,
    });
    expect(await management.accessHistory(mockCompanyIds.Norte)).toEqual([]);
    await expect(
      management.registerAdhesion({
        requestId: crypto.randomUUID(),
        companyId: mockCompanyIds.Norte,
        evidenceReference: '',
      }),
    ).rejects.toThrow();
  });
  it('referência de outra empresa não libera acesso e empresa bloqueada continua sem nova autorização', async () => {
    const { management, company, register } = await newCompany();
    await register();
    await expect(
      management.addAccess({
        requestId: crypto.randomUUID(),
        companyId: mockCompanyIds.Norte,
        values: { name: 'Sem referência', email: 'norte@example.test' },
      }),
    ).rejects.toThrow('adesão');
    await management.registerAdhesion({
      requestId: crypto.randomUUID(),
      companyId: mockCompanyIds.Horizonte,
      evidenceReference: 'Referência sintética',
    });
    await expect(
      management.addAccess({
        requestId: crypto.randomUUID(),
        companyId: mockCompanyIds.Horizonte,
        values: { name: 'Bloqueada', email: 'blocked@example.test' },
      }),
    ).rejects.toThrow('não está disponível');
    expect(await management.accessHistory(company.id)).toEqual([]);
  });
  it('service recusa referências e histórico de outra empresa', async () => {
    const { management, company, register } = await newCompany();
    const record = await register();
    const foreign = createCompaniesService(
      createMockHttpClient(createStaticResponseAdapter([record])),
    ).management;
    if (!foreign) throw new Error('Sem gestão');
    await expect(foreign.adhesions(mockCompanyIds.Norte)).rejects.toThrow('outra empresa');
    expect(await management.accessHistory(company.id)).toEqual([]);
  });
});
