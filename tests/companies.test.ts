import { describe, expect, it } from 'vitest';
import { createMockHttpClient } from '../src/mocks/http/client';
import { createCompaniesMockAdapter } from '../src/mocks/adapters/companies';
import { mockCompanyIds } from '../src/mocks/fixtures/companies';
import { foreignCompanyAccesses, unknownCompanyId } from './fixtures/companies';
import { createStaticResponseAdapter } from './mocks/http';
import { createCompaniesService } from '../src/api/modules/companies/service';
import { companyKeys } from '../src/api/modules/companies/keys';
import { companySearchSchema } from '../src/api/modules/companies/schemas';
import { createQueryClient } from '../src/api/query-client';

const createService = () =>
  createCompaniesService(createMockHttpClient(createCompaniesMockAdapter()));

describe('módulo empresas', () => {
  it('consulta com filtros normalizados e valida retorno', async () => {
    const service = createService();
    const result = await service.list({ q: '  AURORA  ', status: 'active' });
    expect(result.map((company) => company.id)).toEqual([mockCompanyIds.Aurora]);
    expect(await service.list({ q: 'Aurora', status: 'blocked' })).toEqual([]);
  });

  it('separa acessos e permite detalhe independente da lista filtrada', async () => {
    const service = createService();
    expect((await service.detail(mockCompanyIds.Norte)).displayName).toBe('Norte Digital');
    const accesses = await service.accesses(mockCompanyIds.Aurora);
    expect(accesses).toHaveLength(4);
    expect(accesses.every((access) => access.companyId === mockCompanyIds.Aurora)).toBe(true);
    expect(
      (await service.accesses(mockCompanyIds.Norte)).some((access) =>
        accesses.some((other) => other.id === access.id),
      ),
    ).toBe(false);
  });

  it('recusa empresa inexistente e resposta de acessos de outra empresa', async () => {
    const source = createService();
    await expect(source.detail(unknownCompanyId)).rejects.toThrow('Empresa não encontrada');
    const client = createMockHttpClient(createStaticResponseAdapter(foreignCompanyAccesses));
    await expect(createCompaniesService(client).accesses(mockCompanyIds.Aurora)).rejects.toThrow(
      'incompatível com a empresa',
    );
  });

  it('não aceita resposta de transporte sem contrato válido', async () => {
    const client = createMockHttpClient(createStaticResponseAdapter([{ id: 5 }]));
    await expect(createCompaniesService(client).list({ q: '', status: 'all' })).rejects.toThrow();
  });

  it('normaliza URL inválida sem aceitar objeto como filtro ou ID arbitrário', () => {
    expect(
      companySearchSchema.parse({ q: ['x'], status: 'administrator', companyId: '../other' }),
    ).toEqual({ q: '', status: 'all' });
  });

  it('compartilha apenas cache do mesmo ator/empresa e filtro equivalente', async () => {
    const cache = createQueryClient();
    const filters = { q: '  Aurora ', status: 'all' } as const;
    const equivalent = { q: 'aurora', status: 'all' } as const;
    expect(companyKeys.list('admin-a', filters)).toEqual(companyKeys.list('admin-a', equivalent));
    cache.setQueryData(companyKeys.accesses('admin-a', mockCompanyIds.Aurora), ['scope-a']);
    expect(
      cache.getQueryData(companyKeys.accesses('admin-b', mockCompanyIds.Aurora)),
    ).toBeUndefined();
    expect(
      cache.getQueryData(companyKeys.accesses('admin-a', mockCompanyIds.Norte)),
    ).toBeUndefined();
    cache.clear();
  });
});
