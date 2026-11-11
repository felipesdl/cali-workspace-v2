import { createClient } from '@supabase/supabase-js';
import { createMemoryHistory } from '@tanstack/react-router';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { createPreRegistration } from '../src/api/admin/companies/pre-registration';
import { App } from '../src/app/App';
import { createAppRouter } from '../src/app/router';

it('envia somente os campos do pré-cadastro pela rota pública e exibe o recibo', async () => {
  const token = '20000000-0000-4000-8000-000000000001';
  const transport = vi.fn<typeof fetch>(async () => Response.json(null));
  const client = createClient('https://example.supabase.co', 'sb_publishable_test', {
    db: { schema: 'cali_workspace' },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: transport },
  });
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: ['/pre-cadastro/' + token] }),
  );
  router.update({
    context: { ...router.options.context, preRegistration: createPreRegistration(client) },
  });
  await act(async () => router.load());
  render(<App router={router} />);

  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Nome da empresa'), 'Empresa sintética');
  await user.type(screen.getByLabelText('Razão social'), 'Empresa Ltda.');
  await user.type(screen.getByLabelText('Cidade'), 'Curitiba');
  await user.type(screen.getByLabelText('UF'), 'pr');
  await user.type(screen.getByLabelText('Pessoa de contato'), 'Contato de teste');
  await user.type(screen.getByLabelText('E-mail de trabalho'), 'contato@example.invalid');
  await user.click(screen.getByRole('button', { name: 'Enviar dados da empresa' }));

  expect(await screen.findByText(/Dados enviados/)).toBeTruthy();
  expect(transport).toHaveBeenCalledOnce();
  const call = transport.mock.calls[0];
  expect(String(call?.[0])).toContain('/rest/v1/rpc/v2_submit_pre_registration');
  expect(JSON.parse(String(call?.[1]?.body))).toEqual({
    p_token: token,
    p_name: 'Empresa sintética',
    p_legal_name: 'Empresa Ltda.',
    p_city: 'Curitiba',
    p_state: 'PR',
    p_contact: 'Contato de teste',
    p_email: 'contato@example.invalid',
  });
});
