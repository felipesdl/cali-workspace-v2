import { act, render, screen, waitFor } from '@testing-library/react';
import { createMemoryHistory } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { createAppRouter } from '../src/app/router';
import { App } from '../src/app/App';
import { createSessionController } from '../src/app/session/controller';
import { type WorkspaceAccessState } from '../src/api/modules/access/session';
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
