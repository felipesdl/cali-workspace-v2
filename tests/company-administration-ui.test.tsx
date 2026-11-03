import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from '@tanstack/react-router';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/App';
import { createAppRouter } from '../src/app/router';
import { createQueryClient } from '../src/api/query-client';
import {
  createCompaniesService,
  type CompaniesService,
} from '../src/api/modules/companies/service';
import { companyKeys } from '../src/api/modules/companies/keys';
import { createCompaniesMockAdapter } from '../src/mocks/adapters/companies';
import { createMockHttpClient } from '../src/mocks/http/client';
import { mockCompanyIds } from '../src/mocks/fixtures/companies';

async function openApp(unavailable = false) {
  const original = createCompaniesService(createMockHttpClient(createCompaniesMockAdapter()));
  if (!original.management) throw new Error('Teste sem gestão');
  const administration = original.management.administration;
  const read = vi.spyOn(administration, 'read');
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
  if (!unavailable) await screen.findByRole('button', { name: 'Editar ficha administrativa' });
  return { user: userEvent.setup(), administration, read, cache, router };
}
async function edit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Editar ficha administrativa' }));
  await screen.findByRole('form', { name: 'Editar ficha administrativa' });
}

describe('ficha administrativa na jornada Admin demonstrativa', () => {
  it('salva contrato/financeiro/documentos, confirma retorno e apresenta histórico', async () => {
    const errors = vi.spyOn(console, 'error');
    const { user, administration } = await openApp();
    await edit(user);
    expect(screen.getByLabelText('Valor do contrato (R$)')).toHaveProperty('value', '');
    expect(screen.getByLabelText('Antecedência do aviso (dias)')).toHaveProperty('value', '');
    fireEvent.change(screen.getByLabelText('Início do contrato'), {
      target: { value: '2026-11-02' },
    });
    fireEvent.change(screen.getByLabelText('Término do contrato'), {
      target: { value: '2027-11-02' },
    });
    await user.selectOptions(screen.getByLabelText('Tipo de contrato'), 'CALI Full');
    await user.selectOptions(
      screen.getByLabelText('Renovação automática, conforme contrato'),
      'yes',
    );
    await user.type(screen.getByLabelText('Valor do contrato (R$)'), '1234,56');
    await user.selectOptions(screen.getByLabelText('Recorrência de cobrança'), 'monthly');
    await user.selectOptions(screen.getByLabelText('Regra de vencimento'), 'fixed_day');
    await user.type(screen.getByLabelText('Dia fixo de vencimento'), '15');
    await user.type(
      screen.getByLabelText('Link da pasta documental'),
      'https://example.test/pasta-sintetica',
    );
    await user.type(screen.getByLabelText('Responsável documental'), 'Pessoa sintética');
    await user.click(screen.getByRole('button', { name: 'Salvar ficha administrativa' }));
    expect(await screen.findByText('Ficha administrativa salva na demonstração.')).toBeTruthy();
    await waitFor(() => expect(document.activeElement?.id).toBe('administration-title'));
    const record = await administration.read(mockCompanyIds.Aurora);
    expect(record.values).toMatchObject({
      contractValue: 1234.56,
      billingDay: 15,
      autoRenew: true,
      documentOwner: 'Pessoa sintética',
    });
    await user.click(screen.getByText('Financeiro', { selector: 'summary' }));
    expect(screen.getByText(/^R\$\s1\.234,56$/)).toBeTruthy();
    await user.click(
      screen.getByText('Histórico da ficha administrativa', { selector: 'summary' }),
    );
    expect(await screen.findByText('Ficha administrativa · revisão 1')).toBeTruthy();
    await user.click(
      screen.getByText('Consultar alterações da revisão 1', { selector: 'summary' }),
    );
    expect(screen.getByText('Depois: Pessoa sintética')).toBeTruthy();
    expect(await administration.history(mockCompanyIds.Aurora)).toHaveLength(1);
    expect(errors).not.toHaveBeenCalled();
  });

  it('cancelar não grava e volta o foco; trocar empresa descarta rascunho anterior', async () => {
    const { user, administration } = await openApp();
    await edit(user);
    await user.type(screen.getByLabelText('Observação financeira'), 'Rascunho cancelado');
    await user.click(screen.getByRole('button', { name: 'Cancelar ficha' }));
    await waitFor(() => expect(document.activeElement?.id).toBe('administration-title'));
    expect(await administration.history(mockCompanyIds.Aurora)).toHaveLength(0);
    await edit(user);
    expect(screen.getByLabelText('Observação financeira')).toHaveProperty('value', '');
    await user.type(screen.getByLabelText('Observação financeira'), 'Rascunho Aurora');
    await user.click(screen.getByRole('button', { name: 'Ver acessos de Norte Digital' }));
    await screen.findByRole('heading', { name: 'Acessos · Norte Digital' });
    await edit(user);
    expect(screen.getByLabelText('Observação financeira')).toHaveProperty('value', '');
    expect(await administration.history(mockCompanyIds.Aurora)).toHaveLength(0);
  });

  it('erro de validação é associado ao campo e impede gravar', async () => {
    const { user, administration } = await openApp();
    await edit(user);
    const amount = screen.getByLabelText('Valor do contrato (R$)');
    await user.type(amount, '1.234,56');
    const error = await screen.findByText('Use até duas casas decimais, sem separador de milhar.');
    expect(amount.getAttribute('aria-describedby')).toBe(error.id);
    expect(amount.getAttribute('aria-invalid')).toBe('true');
    expect(
      screen.getByRole('button', { name: 'Salvar ficha administrativa' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(await administration.history(mockCompanyIds.Aurora)).toHaveLength(0);
  });

  it('refetch não sobrescreve rascunho; conflito exige descarte explícito', async () => {
    const { user, administration, cache } = await openApp();
    await edit(user);
    await user.type(screen.getByLabelText('Observação financeira'), 'Rascunho preservado');
    const current = await administration.read(mockCompanyIds.Aurora);
    await administration.update({
      companyId: current.companyId,
      expectedRevision: current.revision,
      requestId: crypto.randomUUID(),
      values: { ...current.values, documentOwner: 'Outra edição sintética' },
    });
    await act(async () => {
      await cache.invalidateQueries({ queryKey: companyKeys.all('mock-admin') });
    });
    expect(screen.getByLabelText('Observação financeira')).toHaveProperty(
      'value',
      'Rascunho preservado',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar ficha administrativa' }));
    expect(
      await screen.findByText('A ficha mudou. Descarte o rascunho e recarregue antes de editar.'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Observação financeira')).toHaveProperty(
      'value',
      'Rascunho preservado',
    );
    expect(await administration.history(mockCompanyIds.Aurora)).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Descartar ficha e recarregar' }));
    await screen.findByRole('button', { name: 'Editar ficha administrativa' });
    await edit(user);
    expect(screen.getByLabelText('Responsável documental')).toHaveProperty(
      'value',
      'Outra edição sintética',
    );
    expect(screen.getByLabelText('Observação financeira')).toHaveProperty('value', '');
  });

  it('falha mantém dados editados e não repete a gravação automaticamente', async () => {
    const { user, administration } = await openApp();
    const update = vi
      .spyOn(administration, 'update')
      .mockRejectedValue(new Error('Falha sintética de transporte'));
    await edit(user);
    await user.type(screen.getByLabelText('Observação documental'), 'Documento sintético');
    await user.click(screen.getByRole('button', { name: 'Salvar ficha administrativa' }));
    expect(await screen.findByText('Falha sintética de transporte')).toBeTruthy();
    expect(screen.getByLabelText('Observação documental')).toHaveProperty(
      'value',
      'Documento sintético',
    );
    expect(update).toHaveBeenCalledTimes(1);
    expect(await administration.history(mockCompanyIds.Aurora)).toHaveLength(0);
  });

  it('gravação pendente bloqueia campos e repetição até confirmar a resposta', async () => {
    const { user, administration } = await openApp();
    const originalUpdate = administration.update;
    let release = async () => {};
    const update = vi.spyOn(administration, 'update').mockImplementation(
      (input) =>
        new Promise((resolve) => {
          release = async () => {
            resolve(await originalUpdate(input));
          };
        }),
    );
    await edit(user);
    await user.type(screen.getByLabelText('Observação financeira'), 'Condição sintética pendente');
    const save = screen.getByRole('button', { name: 'Salvar ficha administrativa' });
    await user.click(save);
    await waitFor(() =>
      expect(screen.getByLabelText('Observação financeira').matches(':disabled')).toBe(true),
    );
    await user.click(save);
    expect(update).toHaveBeenCalledTimes(1);
    await act(async () => {
      await release();
    });
    expect(await screen.findByText('Ficha administrativa salva na demonstração.')).toBeTruthy();
  });

  it('capacidade indisponível não apresenta ficha nem aciona sua consulta', async () => {
    const { read } = await openApp(true);
    expect(screen.queryByRole('heading', { name: 'Ficha administrativa' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Editar ficha administrativa' })).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
});
