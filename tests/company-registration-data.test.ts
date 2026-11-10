import { describe, expect, it } from 'vitest';
import { createCompaniesService } from '../src/api/admin/companies/service';
import { createCompaniesMockAdapter } from '../src/mocks/adapters/companies';
import { createMockHttpClient } from '../src/mocks/http/client';
import { mockCompanyIds } from '../src/mocks/fixtures/companies';
import {
  registrationDraftSchema,
  registrationToDraft,
} from '../src/modules/admin/companies/components/registration-draft';
import {
  companyService,
  registrationValuesSchema,
  updateRegistrationSchema,
  logoSchema,
  logoLimits,
} from '../src/api/admin/companies/registration-schemas';
import { createStaticResponseAdapter } from './mocks/http';
import { companyLogoFixture } from './fixtures/company-logo';
import { prepareCompanyLogo } from '../src/modules/admin/companies/components/company-logo';
function setup() {
  const service = createCompaniesService(createMockHttpClient(createCompaniesMockAdapter()));
  if (!service.management) throw new Error('Gestão de teste indisponível');
  return { service, registration: service.management.registration };
}
const companyId = mockCompanyIds.Aurora;
describe('dados cadastrais complementares', () => {
  it('parte apenas do plano conhecido e não inventa contato/endereço/capacidade', async () => {
    const { registration } = setup();
    const current = await registration.read(companyId);
    expect(current.values).toMatchObject({
      service: companyService.Partner,
      monthlyHours: null,
      city: '',
      state: '',
      contactEmail: '',
      logo: null,
    });
    expect(current.revision).toBe(0);
    expect(await registration.history(companyId)).toHaveLength(0);
  });
  it('mapeia os dois Build sem perder identificação, sem modificar acesso ou finanças', async () => {
    const { registration, service } = setup();
    const accessBefore = await service.accesses(companyId);
    const detailsBefore = await service.detail(companyId);
    if (!service.management) throw new Error('Sem gestão');
    const financeBefore = await service.management.administration.read(companyId);
    const current = await registration.read(companyId);
    await registration.update({
      companyId,
      requestId: crypto.randomUUID(),
      expectedRevision: 0,
      values: {
        ...current.values,
        service: companyService.BuildEssential,
        monthlyHours: 12.5,
        contactName: 'Pessoa sintética',
        contactEmail: 'contato1.empresa1@example.test',
      },
    });
    expect((await service.detail(companyId)).plan).toBe('build_essential');
    const second = await registration.read(companyId);
    await registration.update({
      companyId,
      requestId: crypto.randomUUID(),
      expectedRevision: 1,
      values: { ...second.values, service: companyService.BuildComplete },
    });
    expect((await service.detail(companyId)).plan).toBe('build_complete');
    expect(await service.accesses(companyId)).toEqual(accessBefore);
    expect(await service.management.administration.read(companyId)).toEqual(financeBefore);
    expect((await service.detail(companyId)).status).toBe(detailsBefore.status);
  });
  it('customizado preserva plano anterior; repetição/no-op não reescreve histórico', async () => {
    const { registration, service } = setup();
    const previous = await registration.read(companyId);
    const input = {
      companyId,
      requestId: crypto.randomUUID(),
      expectedRevision: 0,
      values: {
        ...previous.values,
        service: companyService.Custom,
        city: 'Cidade sintética',
        logo: companyLogoFixture,
      },
    };
    const first = await registration.update(input);
    expect(await registration.update(input)).toEqual(first);
    await expect(
      registration.update({ ...input, values: { ...input.values, city: 'Outro lugar' } }),
    ).rejects.toThrow('solicitação já foi usada');
    const next = await registration.update({
      ...input,
      requestId: crypto.randomUUID(),
      expectedRevision: 1,
    });
    expect(next.revision).toBe(1);
    expect((await service.detail(companyId)).plan).toBe('partner');
    expect(await registration.history(companyId)).toHaveLength(1);
    const current = await registration.update({
      ...input,
      requestId: crypto.randomUUID(),
      expectedRevision: 1,
      values: { ...input.values, logo: null },
    });
    const history = await registration.history(companyId);
    expect(history[0].current.values.logo).toEqual(companyLogoFixture);
    expect(history[1].previous).toEqual(first);
    expect(history[1].current).toEqual(current);
    await registration.update(input);
    expect((await registration.read(companyId)).revision).toBe(2);
  });
  it('uma edição concorrente vence; não vaza dados entre empresas/instâncias', async () => {
    const { registration } = setup();
    const previous = await registration.read(companyId);
    const command = () => ({
      companyId,
      requestId: crypto.randomUUID(),
      expectedRevision: 0,
      values: { ...previous.values, city: 'Cidade teste' },
    });
    const results = await Promise.allSettled([
      registration.update(command()),
      registration.update(command()),
    ]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(await registration.history(companyId)).toHaveLength(1);
    expect((await registration.read(mockCompanyIds.Norte)).values.city).toBe('');
    expect((await setup().registration.read(companyId)).values.city).toBe('');
  });
  it('valida hora, e-mail, data, UF, filiais e logo; normaliza sem perder segmento livre', async () => {
    const record = await setup().registration.read(companyId);
    const draft = registrationToDraft(record.values);
    const value = registrationDraftSchema.parse({
      ...draft,
      monthlyHours: '12,5',
      segment: 'Segmento próprio',
      state: 'pr',
      hasBranches: 'yes',
      branches: ' Cidade A \n\nCidade B',
      contactEmail: ' COMERCIAL@EXAMPLE.TEST ',
    });
    expect(value).toMatchObject({
      monthlyHours: 12.5,
      segment: 'Segmento próprio',
      state: 'PR',
      branches: ['Cidade A', 'Cidade B'],
      contactEmail: 'comercial@example.test',
    });
    expect(registrationDraftSchema.parse(registrationToDraft(value))).toEqual(value);
    expect(
      registrationDraftSchema.parse({
        ...draft,
        hasBranches: 'no',
        branches: 'Filial antiga',
        monthlyHours: '0',
      }),
    ).toMatchObject({ branches: [], monthlyHours: null });
    for (const monthlyHours of ['-1', '1.000,5', 'NaN', '1e2'])
      expect(registrationDraftSchema.safeParse({ ...draft, monthlyHours }).success).toBe(false);
    expect(registrationDraftSchema.safeParse({ ...draft, contactEmail: 'inválido' }).success).toBe(
      false,
    );
    expect(
      registrationDraftSchema.safeParse({ ...draft, contactBirthday: '2026-02-29' }).success,
    ).toBe(false);
    expect(registrationDraftSchema.safeParse({ ...draft, state: 'PAR' }).success).toBe(false);
    expect(logoSchema.safeParse({ ...companyLogoFixture, bytes: 1 }).success).toBe(false);
    expect(
      logoSchema.safeParse({ ...companyLogoFixture, dataUrl: 'https://example.test/logo.png' })
        .success,
    ).toBe(false);
    expect(
      registrationValuesSchema.safeParse({ ...record.values, service: 'serviço inventado' })
        .success,
    ).toBe(false);
  });
  it('recusa autoria, rota/retorno de outra empresa e não repete escrita em confirmação inválida', async () => {
    const record = await setup().registration.read(companyId);
    const input = {
      companyId,
      requestId: crypto.randomUUID(),
      expectedRevision: 0,
      values: record.values,
    };
    expect(
      updateRegistrationSchema.safeParse({ ...input, recordedBy: crypto.randomUUID() }).success,
    ).toBe(false);
    const client = createMockHttpClient(createCompaniesMockAdapter());
    await expect(
      client.patch(`/companies/${mockCompanyIds.Norte}/registration`, input),
    ).rejects.toThrow('Empresa incompatível');
    const foreign = await setup().registration.read(mockCompanyIds.Norte);
    const fake = createCompaniesService(
      createMockHttpClient(createStaticResponseAdapter(foreign)),
    ).management;
    if (!fake) throw new Error('Sem gestão');
    await expect(fake.registration.read(companyId)).rejects.toThrow('outra empresa');
    await expect(fake.registration.update(input)).rejects.toThrow('Não foi possível confirmar');
  });
  it('recusa formato e tamanho de arquivo antes da leitura local', async () => {
    const signal = new AbortController().signal;
    await expect(
      prepareCompanyLogo(new File(['texto'], 'logo.txt', { type: 'text/plain' }), signal),
    ).rejects.toThrow('Use uma imagem');
    await expect(
      prepareCompanyLogo(
        new File([new Uint8Array(logoLimits.inputBytes + 1)], 'grande.png', { type: 'image/png' }),
        signal,
      ),
    ).rejects.toThrow('12 MB');
  });
});
