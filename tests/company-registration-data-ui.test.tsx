import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from '@tanstack/react-router';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/App';
import { createAppRouter } from '../src/app/router';
import { createQueryClient } from '../src/api/query-client';
import { createCompaniesService, type CompaniesService } from '../src/api/admin/companies/service';
import { companyKeys } from '../src/api/admin/companies/keys';
import { type CompanyLogo } from '../src/api/admin/companies/registration-schemas';
import { createCompaniesMockAdapter } from '../src/mocks/adapters/companies';
import { createMockHttpClient } from '../src/mocks/http/client';
import { mockCompanyIds } from '../src/mocks/fixtures/companies';
import { companyLogoFixture, companyLogoFile } from './fixtures/company-logo';
import * as imagePreparation from '../src/modules/admin/companies/components/company-logo';
async function openApp(unavailable = false) {
  const original = createCompaniesService(createMockHttpClient(createCompaniesMockAdapter()));
  if (!original.management) throw new Error('Sem gestão');
  const registration = original.management.registration;
  const read = vi.spyOn(registration, 'read');
  const service: CompaniesService = unavailable ? { ...original, management: null } : original;
  const cache = createQueryClient();
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [`/admin/clientes?companyId=${mockCompanyIds.Aurora}`] }),
    cache,
  );
  router.update({
    context: { queryClient: cache, session: null, access: null, companies: service },
  });
  await act(async () => {
    await router.load();
  });
  render(
    <StrictMode>
      <App router={router} />
    </StrictMode>,
  );
  await screen.findByRole('heading', { name: 'Acessos · Aurora Tecnologia' }, { timeout: 5000 });
  if (!unavailable) await screen.findByRole('button', { name: 'Editar cadastro da empresa' });
  return { user: userEvent.setup(), registration, service, cache, read };
}
async function edit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Editar cadastro da empresa' }));
  await screen.findByRole('form', { name: 'Editar dados cadastrais' });
}
describe('cadastro empresarial complementar na demonstração', () => {
  it('salva serviço/endereço/filiais/contato/logo, atualiza plano e preserva acessos', async () => {
    const errors = vi.spyOn(console, 'error');
    vi.spyOn(imagePreparation, 'prepareCompanyLogo').mockResolvedValue(companyLogoFixture);
    const { user, service, registration } = await openApp();
    const before = await service.accesses(mockCompanyIds.Aurora);
    await edit(user);
    await user.selectOptions(screen.getByLabelText('Serviço contratado'), 'CALI Build Completo');
    await user.type(screen.getByLabelText('Horas mensais contratadas'), '12,5');
    await user.type(screen.getByLabelText('Segmento da empresa'), 'Segmento sintético');
    await user.type(screen.getByLabelText('Cidade'), 'Cidade teste');
    await user.type(screen.getByLabelText('Estado (sigla)'), 'pr');
    await user.selectOptions(screen.getByLabelText('Possui filiais'), 'yes');
    await user.type(screen.getByLabelText('Localidades das filiais'), 'Local A\nLocal B');
    await user.type(screen.getByLabelText('Nome do contato comercial'), 'Pessoa comercial');
    await user.type(screen.getByLabelText('E-mail comercial'), 'comercial@example.test');
    await user.upload(screen.getByLabelText('Selecionar logo'), companyLogoFile());
    expect(await screen.findByRole('img', { name: 'Prévia da logo da empresa' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Salvar dados cadastrais' }));
    expect(await screen.findByText('Dados cadastrais salvos na demonstração.')).toBeTruthy();
    await waitFor(() => expect(document.activeElement?.id).toBe('registration-title'));
    expect((await service.detail(mockCompanyIds.Aurora)).plan).toBe('build_complete');
    expect(await service.accesses(mockCompanyIds.Aurora)).toEqual(before);
    expect((await registration.read(mockCompanyIds.Aurora)).values).toMatchObject({
      monthlyHours: 12.5,
      state: 'PR',
      branches: ['Local A', 'Local B'],
      contactEmail: 'comercial@example.test',
      logo: companyLogoFixture,
    });
    await user.click(screen.getByText('Histórico dos dados cadastrais', { selector: 'summary' }));
    await user.click(screen.getByText('Consultar dados da revisão 1', { selector: 'summary' }));
    expect(screen.getByText('Depois: Cidade teste')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Logo registrada na revisão' })).toBeTruthy();
    expect(errors).not.toHaveBeenCalled();
  });
  it('remover logo no rascunho não grava ao cancelar; salvar remoção preserva histórico', async () => {
    const { user, registration, cache } = await openApp();
    const current = await registration.read(mockCompanyIds.Aurora);
    await registration.update({
      requestId: crypto.randomUUID(),
      companyId: current.companyId,
      expectedRevision: 0,
      values: { ...current.values, logo: companyLogoFixture },
    });
    await act(async () => {
      await cache.invalidateQueries({ queryKey: companyKeys.all('mock-admin') });
    });
    await screen.findByRole('img', { name: 'Logo da empresa' });
    await edit(user);
    await user.click(screen.getByRole('button', { name: 'Remover logo do rascunho' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar cadastro da empresa' }));
    expect((await registration.read(mockCompanyIds.Aurora)).values.logo).toEqual(
      companyLogoFixture,
    );
    await waitFor(() => expect(document.activeElement?.id).toBe('registration-title'));
    await edit(user);
    await user.click(screen.getByRole('button', { name: 'Remover logo do rascunho' }));
    await user.click(screen.getByRole('button', { name: 'Salvar dados cadastrais' }));
    await screen.findByText('Dados cadastrais salvos na demonstração.');
    expect((await registration.read(mockCompanyIds.Aurora)).values.logo).toBeNull();
    expect((await registration.history(mockCompanyIds.Aurora))[1].previous.values.logo).toEqual(
      companyLogoFixture,
    );
  });
  it('resultado tardio de logo é ignorado ao trocar empresa e salvar fica bloqueado durante preparo', async () => {
    let finish: (logo: CompanyLogo) => void = () => {};
    let signal: AbortSignal | undefined;
    vi.spyOn(imagePreparation, 'prepareCompanyLogo').mockImplementation((_file, abort) => {
      signal = abort;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const { user } = await openApp();
    await edit(user);
    await user.upload(screen.getByLabelText('Selecionar logo'), companyLogoFile());
    expect(await screen.findByText('Preparando logo…')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Salvar dados cadastrais' }).hasAttribute('disabled'),
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Ver acessos de Norte Digital' }));
    await screen.findByRole('heading', { name: 'Acessos · Norte Digital' });
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      finish(companyLogoFixture);
    });
    await edit(user);
    expect(screen.queryByRole('img', { name: 'Prévia da logo da empresa' })).toBeNull();
    expect(screen.queryByText('Preparando logo…')).toBeNull();
  });
  it('novo arquivo vence resultado anterior; falha preserva prévia válida', async () => {
    let finish: (logo: CompanyLogo) => void = () => {};
    const prepare = vi
      .spyOn(imagePreparation, 'prepareCompanyLogo')
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValueOnce({ ...companyLogoFixture, sourceName: 'atual.png' })
      .mockRejectedValueOnce(new Error('Imagem sintética inválida'));
    const { user } = await openApp();
    await edit(user);
    await user.upload(screen.getByLabelText('Selecionar logo'), companyLogoFile());
    await user.upload(
      screen.getByLabelText('Selecionar logo'),
      new File(['segunda'], 'atual.png', { type: 'image/png' }),
    );
    expect(await screen.findByText(/atual.png/)).toBeTruthy();
    await act(async () => {
      finish(companyLogoFixture);
    });
    expect(screen.queryByText(/logo-sintetica.png/)).toBeNull();
    await user.upload(screen.getByLabelText('Selecionar logo'), companyLogoFile());
    expect(await screen.findByText('Imagem sintética inválida')).toBeTruthy();
    expect(screen.getByText(/atual.png/)).toBeTruthy();
    expect(prepare).toHaveBeenCalledTimes(3);
  });
  it('conflito mantém rascunho e permite descarte explícito sem alterar plano', async () => {
    const { user, registration, cache, service } = await openApp();
    await edit(user);
    await user.type(screen.getByLabelText('Cidade'), 'Rascunho local');
    await user.selectOptions(screen.getByLabelText('Serviço contratado'), 'CALI Build Essencial');
    const previous = await registration.read(mockCompanyIds.Aurora);
    await registration.update({
      companyId: previous.companyId,
      expectedRevision: 0,
      requestId: crypto.randomUUID(),
      values: { ...previous.values, city: 'Outra edição' },
    });
    await act(async () => {
      await cache.invalidateQueries({ queryKey: companyKeys.all('mock-admin') });
    });
    expect(screen.getByLabelText('Cidade')).toHaveProperty('value', 'Rascunho local');
    await user.click(screen.getByRole('button', { name: 'Salvar dados cadastrais' }));
    expect(
      await screen.findByText(
        'O cadastro mudou. Descarte o rascunho e recarregue antes de editar.',
      ),
    ).toBeTruthy();
    expect((await service.detail(mockCompanyIds.Aurora)).plan).toBe('partner');
    await user.click(screen.getByRole('button', { name: 'Descartar cadastro e recarregar' }));
    await edit(user);
    expect(screen.getByLabelText('Cidade')).toHaveProperty('value', 'Outra edição');
  });
  it('capacidade indisponível não consulta nem apresenta os dados complementares', async () => {
    const { read } = await openApp(true);
    expect(screen.queryByRole('heading', { name: 'Dados cadastrais' })).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
});
