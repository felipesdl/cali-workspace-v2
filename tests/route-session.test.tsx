import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { createAppRouter } from '../src/app/router';
import { App } from '../src/app/App';
import { createSessionController } from '../src/app/session/controller';
import { type WorkspaceAccessState } from '../src/api/access/session';
import { createQueryClient } from '../src/api/query-client';

const snapshot = (): WorkspaceAccessState => ({
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
    version: 'local-test',
    contentHash: 'a'.repeat(64),
    title: 'Teste',
    content: 'Texto sintético',
  },
});
describe('guardas preparadas no roteador', () => {
  it('preserva a empresa Admin ao trocar de módulo sem carregar o detalhe anterior', async () => {
    const companyId = '9c5ab148-78b8-4410-9338-58c44222a5db';
    const project = '10000000-0000-4000-8000-000000000001';
    const cache = createQueryClient();
    const session = createSessionController(
      { read: async () => snapshot(), signOut: async () => {} },
      cache,
    );
    const history = createMemoryHistory({
      initialEntries: [`/admin/projetos?companyId=${companyId}&project=${project}&page=3`],
    });
    const router = createAppRouter(history, cache, session);
    const unexpected = async () => {
      throw new Error('Operação inesperada no cenário de navegação');
    };
    router.update({
      context: {
        ...router.options.context,
        access: {
          read: async () => snapshot(),
          signOut: unexpected,
          requestCode: unexpected,
          verifyCode: unexpected,
          factors: unexpected,
          enrollMfa: unexpected,
          verifyMfa: unexpected,
          acceptTerms: unexpected,
          completeCallback: unexpected,
          subscribe: () => () => {},
        },
        projectWorkspace: {
          detail: async () => null,
          list: async () => ({ companyId, total: 0, projects: [] }),
          catalog: unexpected,
          hours: unexpected,
        },
      },
    });
    await act(async () => {
      await router.load();
    });
    render(<App router={router} />);
    const user = userEvent.setup();
    const menu = await screen.findByRole('button', { name: 'Menu principal' });
    const hoursLink = await screen.findByRole('link', { name: 'Horas' });
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    await user.click(menu);
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    await user.tab();
    await user.keyboard('{Escape}');
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(menu);
    await user.click(menu);
    await user.click(hoursLink);
    const heading = await screen.findByRole('heading', { name: 'Horas', level: 1 });
    expect(router.state.location.pathname).toBe('/admin/horas');
    expect(router.state.location.search).toEqual({ companyId, section: 'deliverables', page: 1 });
    expect(document.activeElement).toBe(heading);
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    expect(hoursLink.getAttribute('aria-current')).toBe('page');
    await act(async () => history.back());
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ companyId, project, page: 3 });
    });
  });

  it('URL direta com termos pendentes não renderiza feature e preserva retorno', async () => {
    const cache = createQueryClient();
    const session = createSessionController(
      {
        read: async () => ({ ...snapshot(), status: 'terms_required', termsAccepted: false }),
        signOut: async () => {},
      },
      cache,
    );
    const router = createAppRouter(
      createMemoryHistory({ initialEntries: ['/admin/clientes?q=teste'] }),
      cache,
      session,
    );
    await act(async () => {
      await router.load();
    });
    render(<App router={router} />);
    expect(await screen.findByRole('heading', { name: 'Acesso indisponível' })).toBeTruthy();
    expect(screen.queryByRole('form', { name: 'Filtrar empresas' })).toBeNull();
    expect(router.state.location.search.returnTo).toBe('/admin/clientes?q=teste');
  });
  it('logout invalida rota, limpa cache e remove a feature montada', async () => {
    const cache = createQueryClient();
    const session = createSessionController(
      { read: async () => snapshot(), signOut: async () => {} },
      cache,
    );
    const router = createAppRouter(
      createMemoryHistory({ initialEntries: ['/admin/clientes'] }),
      cache,
      session,
    );
    await act(async () => {
      await router.load();
    });
    render(<App router={router} />);
    expect(
      await screen.findByRole('form', { name: 'Filtrar empresas' }, { timeout: 5000 }),
    ).toBeTruthy();
    cache.setQueryData(['private-example'], 'empresa anterior');
    await act(async () => {
      await session.signOut();
    });
    expect(await screen.findByRole('heading', { name: 'Acesso indisponível' })).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByRole('form', { name: 'Filtrar empresas' })).toBeNull(),
    );
    expect(cache.getQueryData(['private-example'])).toBeUndefined();
  });
});
