import { act, render, screen } from '@testing-library/react';
import { createClient } from '@supabase/supabase-js';
import { createMemoryHistory } from '@tanstack/react-router';
import { expect, it } from 'vitest';
import { type WorkspaceAccessState } from '../src/api/access/session';
import { createQueryClient } from '../src/api/query-client';
import { createDomainOperations } from '../src/api/shared/workspace/domain-operations';
import { App } from '../src/app/App';
import { createAppRouter } from '../src/app/router';
import { createSessionController } from '../src/app/session/controller';

it('oferece ajuda e pedidos pessoais em Minha conta e deixa Termos para consulta', async () => {
  const access: WorkspaceAccessState = {
    status: 'ready',
    profile: {
      id: '20000000-0000-4000-8000-000000000001',
      company_id: '9c5ab148-78b8-4410-9338-58c44222a5db',
      role: 'client',
      active: true,
    },
    companyStatus: 'active',
    termsAccepted: true,
    terms: {
      version: 'qa',
      title: 'Termos sintéticos',
      content: 'Conteúdo de teste.',
      contentHash: 'a'.repeat(64),
    },
  };
  const db = createClient('https://example.supabase.co', 'sb_publishable_test', {
    db: { schema: 'cali_workspace' },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async () => Response.json([]) },
  });
  const cache = createQueryClient();
  const session = createSessionController(
    { read: async () => access, signOut: async () => {} },
    cache,
  );
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: ['/cliente/minha-conta'] }),
    cache,
    session,
  );
  router.update({
    context: { ...router.options.context, domainOperations: createDomainOperations(db) },
  });
  await act(async () => router.load());
  render(<App router={router} />);

  expect(
    (await screen.findByRole('link', { name: 'Acompanhar um assunto' })).getAttribute('href'),
  ).toMatch(/^\/cliente\/registros/);
  expect(screen.getByRole('link', { name: 'Problemas de acesso' }).getAttribute('href')).toMatch(
    /^mailto:.*@calirh\.com/,
  );
  expect(screen.getByRole('link', { name: 'Pedidos sobre meus dados' }).getAttribute('href')).toBe(
    '#meus-pedidos-de-dados',
  );
  expect(screen.getByRole('form', { name: 'Registrar pedido de privacidade' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'WhatsApp' })).toBeNull();

  await act(async () => {
    void router.navigate({ to: '/cliente/termos' });
  });
  expect(await screen.findByRole('heading', { name: 'Termos sintéticos' })).toBeTruthy();
  expect(screen.queryByRole('form', { name: 'Registrar pedido de privacidade' })).toBeNull();
});
