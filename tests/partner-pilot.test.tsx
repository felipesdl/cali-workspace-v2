import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from '@tanstack/react-router';
import { expect, it, vi } from 'vitest';
import type { PartnerPilot } from '../src/api/modules/partner/pilot';
import { createQueryClient } from '../src/api/query-client';
import { App } from '../src/app/App';
import { createAppRouter } from '../src/app/router';

it('abre apenas o módulo atribuído e retira o detalhe após o corte de acesso', async () => {
  const company = '9c5ab148-78b8-4410-9338-58c44222a5db';
  const id = '20000000-0000-4000-8000-000000000001';
  let revoked = false;
  const read: PartnerPilot['read'] = async () =>
    revoked
      ? { status: 'blocked' }
      : {
          status: 'ready',
          actor: '10000000-0000-4000-8000-000000000001',
          company,
          companyName: 'Empresa fictícia',
          modules: ['projects'],
        };
  const detail = vi.fn(async () => ({
    title: 'Projeto de teste',
    total: 1,
    rows: [{ id, title: 'Entrega de teste', protocol: null, status: null, instant: null }],
  }));
  let notify = () => {};
  const pilot: PartnerPilot = {
    read,
    subscribe(listener) {
      notify = listener;
      return () => {};
    },
    acceptInvite: async () => {},
    acceptTerms: async () => {},
    hourRequests: async () => ({ total: 0, rows: [] }),
    submitHours: async () => id,
    decideHours: async () => id,
    items: async () => ({
      total: 1,
      rows: [
        { id, title: 'Projeto de teste', protocol: null, status: null, day: null, minutes: null },
      ],
    }),
    detail,
  };
  const cache = createQueryClient();
  const router = createAppRouter(createMemoryHistory({ initialEntries: ['/equipe'] }), cache);
  router.update({ context: { ...router.options.context, partnerPilot: pilot } });
  await router.load();
  render(<App router={router} />);

  expect(await screen.findByRole('heading', { name: 'Empresa fictícia' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Ocorrências' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Minhas horas' })).toBeNull();
  await userEvent.click(await screen.findByRole('button', { name: 'Abrir Projeto de teste' }));
  expect(await screen.findByText('Entrega de teste')).toBeTruthy();
  expect(detail).toHaveBeenCalledWith(company, 'projects', id, 1, expect.any(AbortSignal));

  revoked = true;
  act(notify);
  expect(await screen.findByText('Seu acesso à Equipe CALI está indisponível.')).toBeTruthy();
  expect(screen.queryByText('Entrega de teste')).toBeNull();
});
