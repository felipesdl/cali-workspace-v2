import { describe, expect, it } from 'vitest';
import { createCompaniesService } from '../src/api/modules/companies/service';
import { createCompaniesMockAdapter } from '../src/mocks/adapters/companies';
import { createMockHttpClient } from '../src/mocks/http/client';
import { mockCompanyIds } from '../src/mocks/fixtures/companies';
import { createStaticResponseAdapter } from './mocks/http';
import {
  administrationToDraft,
  administrationDraftSchema,
} from '../src/features/companies/administration-draft';
import {
  emptyAdministration,
  updateAdministrationSchema,
} from '../src/api/modules/companies/administration-schemas';

function setup() {
  const service = createCompaniesService(createMockHttpClient(createCompaniesMockAdapter()));
  if (!service.management) throw new Error('Gestão de teste indisponível');
  return { service, administration: service.management.administration };
}
const companyId = mockCompanyIds.Aurora;
function command() {
  return {
    requestId: crypto.randomUUID(),
    companyId,
    expectedRevision: 0,
    values: {
      ...emptyAdministration(companyId).values,
      contractValue: 1234.56,
      financialNote: 'Condição sintética',
    },
  };
}

describe('ficha administrativa demonstrativa', () => {
  it('não fabrica condições conhecidas e mantém instâncias/empresas isoladas', async () => {
    const { administration, service } = setup();
    expect(await administration.read(companyId)).toEqual(emptyAdministration(companyId));
    const beforeCompany = await service.detail(companyId);
    const beforeAccesses = await service.accesses(companyId);
    await administration.update(command());
    expect((await administration.read(companyId)).values.contractValue).toBe(1234.56);
    expect(await administration.read(mockCompanyIds.Norte)).toEqual(
      emptyAdministration(mockCompanyIds.Norte),
    );
    expect(await setup().administration.read(companyId)).toEqual(emptyAdministration(companyId));
    expect(await service.detail(companyId)).toEqual(beforeCompany);
    expect(await service.accesses(companyId)).toEqual(beforeAccesses);
  });

  it('repetição idêntica não duplica histórico e requestId não aceita outro conteúdo', async () => {
    const { administration } = setup();
    const input = command();
    const result = await administration.update(input);
    expect(await administration.update(input)).toEqual(result);
    expect(await administration.history(companyId)).toHaveLength(1);
    await expect(
      administration.update({ ...input, values: { ...input.values, contractValue: 9 } }),
    ).rejects.toThrow('solicitação já foi usada');
    const [event] = await administration.history(companyId);
    expect(event.previous.revision).toBe(0);
    expect(event.current).toEqual(result);
    expect(event.recordedBy).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(Number.isNaN(Date.parse(event.recordedAt))).toBe(false);
  });

  it('somente uma das edições concorrentes da mesma revisão é confirmada', async () => {
    const { administration } = setup();
    const first = command();
    const second = { ...command(), values: { ...first.values, documentOwner: 'Pessoa sintética' } };
    const results = await Promise.allSettled([
      administration.update(first),
      administration.update(second),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await administration.history(companyId)).toHaveLength(1);
    expect((await administration.read(companyId)).revision).toBe(1);
  });

  it('sem alteração não avança revisão; nova alteração preserva snapshots anteriores', async () => {
    const { administration } = setup();
    const input = command();
    const first = await administration.update(input);
    await administration.update({ ...input, requestId: crypto.randomUUID(), expectedRevision: 1 });
    expect(await administration.history(companyId)).toHaveLength(1);
    const next = await administration.update({
      ...input,
      requestId: crypto.randomUUID(),
      expectedRevision: 1,
      values: { ...input.values, documentNotes: 'Outro documento sintético' },
    });
    expect(next.revision).toBe(2);
    const events = await administration.history(companyId);
    expect(events[0].current).toEqual(first);
    expect(events[1].previous).toEqual(first);
    expect(events[1].current).toEqual(next);
  });

  it('recusa autoria enviada pela UI, rota de outra empresa e resposta incompatível', async () => {
    const input = command();
    expect(
      updateAdministrationSchema.safeParse({ ...input, recordedBy: crypto.randomUUID() }).success,
    ).toBe(false);
    await expect(
      setup().administration.update({
        ...input,
        values: { ...input.values, contractValue: 1.001 },
      }),
    ).rejects.toThrow('duas casas decimais');
    const client = createMockHttpClient(createCompaniesMockAdapter());
    await expect(
      client.patch(`/companies/${mockCompanyIds.Norte}/administration`, input),
    ).rejects.toThrow('Empresa incompatível');
    const foreign = emptyAdministration(mockCompanyIds.Norte);
    const fake = createCompaniesService(
      createMockHttpClient(createStaticResponseAdapter(foreign)),
    ).management;
    if (!fake) throw new Error('Teste sem gestão');
    await expect(fake.administration.read(companyId)).rejects.toThrow('outra empresa');
    await expect(fake.administration.update(input)).rejects.toThrow('Não foi possível confirmar');
  });
});

describe('rascunho contratual e financeiro', () => {
  const draft = () => administrationToDraft(emptyAdministration(companyId).values);
  it('preserva nulos, converte vírgula/ponto decimal e faz roundtrip sem perder texto', () => {
    const parsed = administrationDraftSchema.parse({
      ...draft(),
      contractValue: '1234,56',
      dailyInterestPercent: '0.025',
      penaltyText: 'Cláusula sintética',
      billingDay: '31',
      driveUrl: 'https://example.test/documentos',
    });
    expect(parsed).toMatchObject({
      contractValue: 1234.56,
      dailyInterestPercent: 0.025,
      billingDay: 31,
      startDate: null,
      paymentTermDays: null,
      penaltyText: 'Cláusula sintética',
    });
    expect(administrationDraftSchema.parse(administrationToDraft(parsed))).toEqual(parsed);
    expect(
      administrationDraftSchema.parse({ ...draft(), contractValue: '0' }).contractValue,
    ).toBeNull();
  });
  it('recusa agrupamento ambíguo, valores negativos/não finitos, fração de dias e datas inválidas', () => {
    for (const contractValue of [
      '1.234,56',
      '1,234.56',
      '-1',
      'Infinity',
      '1e3',
      '0x10',
      '10.999',
      '999999999999999999999',
    ]) {
      expect(administrationDraftSchema.safeParse({ ...draft(), contractValue }).success).toBe(
        false,
      );
    }
    expect(administrationDraftSchema.safeParse({ ...draft(), billingDay: '32' }).success).toBe(
      false,
    );
    expect(
      administrationDraftSchema.safeParse({ ...draft(), paymentTermDays: '1,5' }).success,
    ).toBe(false);
    expect(
      administrationDraftSchema.safeParse({ ...draft(), startDate: '2026-02-29' }).success,
    ).toBe(false);
    expect(
      administrationDraftSchema.safeParse({
        ...draft(),
        startDate: '2026-11-02',
        endDate: '2026-11-01',
      }).success,
    ).toBe(false);
  });
  it('aceita somente URL web sem credenciais; nunca precisa acessar o destino', () => {
    for (const driveUrl of [
      'javascript:alert(1)',
      'file:///etc/passwd',
      'https://user:secret@example.test',
      'não é URL',
    ]) {
      expect(administrationDraftSchema.safeParse({ ...draft(), driveUrl }).success).toBe(false);
    }
  });
});
