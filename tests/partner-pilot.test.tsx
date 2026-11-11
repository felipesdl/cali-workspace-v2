import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from '@tanstack/react-router';
import { expect, it, vi } from 'vitest';
import type { PartnerPilot } from '../src/api/partner/pilot';
import { createQueryClient } from '../src/api/query-client';
import { App } from '../src/app/App';
import { createAppRouter } from '../src/app/router';

it('abre apenas o módulo atribuído e retira o detalhe após o corte de acesso', async () => {
  const company = '9c5ab148-78b8-4410-9338-58c44222a5db';
  const id = '20000000-0000-4000-8000-000000000001';
  const stale = new Date(Date.now() - 120000).toISOString();
  let revoked = false;
  const read: PartnerPilot['read'] = async () =>
    revoked
      ? { status: 'blocked' }
      : {
          status: 'ready',
          actor: '10000000-0000-4000-8000-000000000001',
          company,
          companyName: 'Empresa fictícia',
          modules: ['projects', 'hours'],
        };
  const detail = vi.fn(async () => ({
    title: 'Projeto de teste',
    total: 1,
    rows: [{ id, title: 'Entrega de teste', protocol: null, status: null, instant: null }],
  }));
  let notify = () => {};
  const touchTimer = vi.fn(async () => {});
  const pilot: PartnerPilot = {
    codeLength: 8,
    qa: true,
    read,
    subscribe(listener) {
      notify = listener;
      return () => {};
    },
    requestCode: undefined,
    verifyCode: async () => {},
    reviews: async () => ({ total: 0, rows: [] }),
    submitReview: async () => id,
    decideReview: async () => id,
    documentPdf: async () => ({ blob: new Blob(), fileName: 'teste.pdf' }),
    reportPdf: async () => ({ blob: new Blob(), fileName: 'teste.pdf' }),
    replyRecord: async () => id,
    acceptInvite: async () => {},
    acceptTerms: async () => {},
    timer: async () => ({
      active: {
        id,
        description: 'Atividade em andamento',
        startedAt: stale,
        lastSeenAt: stale,
      },
      targets: [],
    }),
    changeTimer: async () => ({ id, status: 'active', minutes: null }),
    touchTimer,
    hourRequests: async () => ({
      total: 1,
      rows: [
        {
          id: '30000000-0000-4000-8000-000000000001',
          day: '2026-11-11',
          minutes: 40,
          description: 'Trecho recuperado',
          justification: 'Sessão foi encerrada automaticamente.',
          status: 'pending',
          decision_note: null,
          member_name: null,
          recoverable: true,
        },
      ],
    }),
    submitHours: async () => id,
    adjustRecoveredHours: async () => id,
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
  expect(screen.queryByRole('link', { name: 'Ocorrências' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Minhas horas' })).toBeTruthy();
  expect(await screen.findByText(/Atividade em andamento/)).toBeTruthy();
  await userEvent.click(await screen.findByRole('button', { name: 'Abrir Projeto de teste' }));
  expect(touchTimer).toHaveBeenCalledWith(company, id);
  expect(await screen.findByText('Entrega de teste')).toBeTruthy();
  expect(detail).toHaveBeenCalledWith(company, 'projects', id, 1, expect.any(AbortSignal));
  const back = screen.getByRole('button', { name: 'Voltar à lista' });
  expect(document.activeElement).toBe(back);
  await userEvent.click(back);
  const open = await screen.findByRole('button', { name: 'Abrir Projeto de teste' });
  expect(document.activeElement).toBe(open);
  await userEvent.click(open);
  expect(await screen.findByText('Entrega de teste')).toBeTruthy();

  await act(async () => {
    router.history.push('/equipe/ocorrencias');
  });
  expect(
    await screen.findByText('Este módulo não está disponível para o seu acesso.'),
  ).toBeTruthy();
  expect(router.state.location.search.modulo).toBe('records');
  expect(screen.queryByText('Entrega de teste')).toBeNull();
  await act(async () => {
    router.history.push('/equipe/horas');
  });
  expect(await screen.findByText(/Atividade em andamento/)).toBeTruthy();
  expect(await screen.findByRole('button', { name: 'Ajustar trecho recuperado' })).toBeTruthy();
  await act(async () => {
    router.history.push('/equipe/projetos');
  });
  expect(await screen.findByText(/Atividade em andamento/)).toBeTruthy();
  await userEvent.click(await screen.findByRole('button', { name: 'Abrir Projeto de teste' }));
  expect(await screen.findByText('Entrega de teste')).toBeTruthy();

  revoked = true;
  act(notify);
  expect(await screen.findByText('Seu acesso à Equipe CALI está indisponível.')).toBeTruthy();
  expect(screen.queryByText('Entrega de teste')).toBeNull();
});
