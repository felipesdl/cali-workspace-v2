import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { App } from '../src/app/App';
import { createAppRouter } from '../src/app/router';
import { createSessionController } from '../src/app/session/controller';
import { createQueryClient } from '../src/api/query-client';
import { createHostedAccessApi } from '../src/api/modules/access/api';
import { composeCompaniesService } from '../src/api/modules/companies/api';
import { createWorkspaceClient } from '../src/api/supabase';
import { mockCompanyIds } from '../src/mocks/fixtures/companies';

async function openApp(entry = '/admin/clientes') {
  const history = createMemoryHistory({ initialEntries: [entry] });
  const cache = createQueryClient();
  const router = createAppRouter(history, cache);
  await act(async () => {
    await router.load();
  });
  render(<App router={router} />);
  if (entry.startsWith('/admin/clientes')) {
    // Primeiro import lazy pode incluir transformação dos módulos no runner, sem rede.
    await screen.findByRole('form', { name: 'Filtrar empresas' }, { timeout: 5000 });
  }
  return { router, history, cache };
}

describe('navegação e formulário de empresas', () => {
  it('mostra a carteira Admin sem habilitar a área de Projetos do piloto', async () => {
    const cache = createQueryClient();
    const session = createSessionController(
      {
        read: async () => ({
          status: 'ready',
          profile: {
            id: '20000000-0000-4000-8000-000000000001',
            company_id: null,
            role: 'admin',
            active: true,
          },
          companyStatus: null,
          termsAccepted: true,
          terms: {
            version: 'qa',
            contentHash: 'a'.repeat(64),
            title: 'Termos sintéticos',
            content: 'Fixture de navegação',
          },
        }),
        signOut: async () => {},
      },
      cache,
    );
    const url = 'https://example.supabase.co';
    const key = 'sb_publishable_test';
    const router = createAppRouter(
      createMemoryHistory({ initialEntries: ['/admin'] }),
      cache,
      session,
      {
        access: createHostedAccessApi(createWorkspaceClient(url, key), url, key),
        companies: composeCompaniesService(null),
        adminPortfolio: {
          read: async (month) => ({
            month,
            hoursMinutes: 120,
            calendarEvents: 0,
            calendarNotices: 0,
            projectAdjustments: 0,
            recordsInProgress: 0,
            satisfactionAverage: null,
            satisfactionCount: 0,
          }),
        },
      },
    );
    await act(async () => {
      await router.load();
    });
    render(<App router={router} />);
    expect(await screen.findByRole('heading', { name: 'Resumo da carteira' })).toBeTruthy();
    expect(await screen.findByText('Horas registradas')).toBeTruthy();
    expect(screen.queryByLabelText('Empresa de homologação')).toBeNull();
  });

  it('abre acesso por URL direta sem visitar lista antes', async () => {
    await openApp(`/admin/clientes?companyId=${mockCompanyIds.Aurora}`);
    expect(
      await screen.findByRole('heading', { name: 'Acessos · Aurora Tecnologia' }),
    ).toBeTruthy();
    expect(await screen.findByText('contato1.empresa1@example.test')).toBeTruthy();
  });

  it('aplica filtros na URL e restaura formulário/lista com Back', async () => {
    const user = userEvent.setup();
    const { router, history } = await openApp();
    await screen.findByText('Aurora Tecnologia');
    await user.type(screen.getByLabelText('Nome da empresa'), 'Norte');
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    await waitFor(() => expect(router.state.location.search.q).toBe('Norte'));
    await waitFor(() => expect(screen.queryByText('Aurora Tecnologia')).toBeNull());
    expect(await screen.findByText('Norte Digital')).toBeTruthy();
    await act(async () => {
      history.back();
    });
    expect(await screen.findByText('Aurora Tecnologia')).toBeTruthy();
    await waitFor(() =>
      expect((screen.getByLabelText('Nome da empresa') as HTMLInputElement).value).toBe(''),
    );
    await act(async () => {
      history.forward();
    });
    await waitFor(() => expect(screen.queryByText('Aurora Tecnologia')).toBeNull());
    expect(await screen.findByText('Norte Digital')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByLabelText('Nome da empresa')).toHaveProperty('value', 'Norte'),
    );
  });

  it('motivo de acesso desconhecido usa mensagem genérica sem falhar na renderização', async () => {
    const { router } = await openApp('/acesso?reason=unknown-external-value');
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('Não foi possível confirmar seu acesso. Tente novamente.'),
    );
    expect(router.state.location.search.reason).toBe('unavailable');
  });

  it('troca detalhe sem manter acessos da empresa anterior como atuais', async () => {
    const user = userEvent.setup();
    await openApp();
    await user.click(
      await screen.findByRole('button', { name: 'Ver acessos de Aurora Tecnologia' }),
    );
    expect(await screen.findByText('contato1.empresa1@example.test')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Ver acessos de Norte Digital' }));
    expect(await screen.findByRole('heading', { name: 'Acessos · Norte Digital' })).toBeTruthy();
    expect(await screen.findByText('contato1.empresa2@example.test')).toBeTruthy();
    expect(screen.queryByText('contato1.empresa1@example.test')).toBeNull();
  });

  it('preserva URLs de outras composições e oferece retorno em rota inexistente', async () => {
    const { router } = await openApp('/cliente/horas');
    expect(await screen.findByRole('heading', { name: /Horas/ })).toBeTruthy();
    act(() => {
      void router.navigate({ to: '/admin' });
    });
    expect(await screen.findByRole('heading', { name: /Visão executiva/ })).toBeTruthy();
    await act(async () => {
      await router.history.push('/rota-inexistente');
    });
    expect(await screen.findByRole('heading', { name: 'Página não encontrada' })).toBeTruthy();
  });

  it.each([
    { role: 'admin' as const, home: '/admin/clientes' },
    { role: 'client' as const, home: '/cliente' },
  ])('retorna à área do papel $role após um link inexistente', async ({ role, home }) => {
    const cache = createQueryClient();
    const session = createSessionController(
      {
        read: async () => ({
          status: 'ready',
          profile: {
            id: '20000000-0000-4000-8000-000000000001',
            company_id: role === 'client' ? mockCompanyIds.Aurora : null,
            role,
            active: true,
          },
          companyStatus: role === 'client' ? 'active' : null,
          termsAccepted: true,
          terms: {
            version: 'qa',
            contentHash: 'a'.repeat(64),
            title: 'Termos sintéticos',
            content: 'Fixture de navegação',
          },
        }),
        signOut: async () => {},
      },
      cache,
    );
    const router = createAppRouter(
      createMemoryHistory({ initialEntries: ['/rota-inexistente'] }),
      cache,
      session,
    );
    await router.load();
    render(<App router={router} />);
    const heading = await screen.findByRole('heading', { name: 'Página não encontrada' });
    expect(document.activeElement).toBe(heading);
    await userEvent.click(await screen.findByRole('link', { name: 'Voltar ao início' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(home));
  });
});
