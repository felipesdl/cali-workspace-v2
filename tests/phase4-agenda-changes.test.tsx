import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '../src/api/query-client';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { AgendaChangeActions } from '../src/features/project-workspace/AgendaChangeActions';

it('envia a opção de remarcação escolhida pelo Admin e mantém o pedido pendente na falha', async () => {
  const company = '9c5ab148-78b8-4410-9338-58c44222a5db';
  const appointment = '30000000-0000-4000-8000-000000000001';
  const change = '30000000-0000-4000-8000-000000000002';
  const decideChange = vi.fn().mockRejectedValue(new Error('O horário ficou indisponível.'));
  const unexpected = async () => {
    throw new Error('Operação não prevista neste fluxo');
  };
  const refresh = vi.fn(async (id: string) => id);
  render(
    <QueryClientProvider client={createQueryClient()}>
      <AgendaChangeActions
        company={company}
        appointment={appointment}
        admin
        eligible
        active
        change={{
          id: change,
          action: 'reschedule',
          status: 'pending',
          reason: 'Conflito de agenda',
          note: null,
          slots: [
            { startsAt: '2026-11-16T12:00:00Z', endsAt: '2026-11-16T13:00:00Z' },
            { startsAt: '2026-11-17T17:00:00Z', endsAt: '2026-11-17T18:00:00Z' },
          ],
        }}
        agenda={{
          decideChange,
          requestChange: unexpected,
          complete: unexpected,
          markAbsent: unexpected,
          list: unexpected,
          listExtras: unexpected,
          request: unexpected,
          respond: unexpected,
        }}
        refresh={refresh}
      />
    </QueryClientProvider>,
  );
  const submit = screen.getByRole('button', { name: 'Aprovar remarcação' });
  const form = submit.closest('form');
  if (!form) throw new Error('Formulário de aprovação ausente');
  await userEvent.selectOptions(within(form).getByLabelText('Novo horário'), '1');
  await userEvent.type(
    within(form).getByLabelText('Explique a decisão'),
    'Segunda opção conferida',
  );
  await userEvent.click(submit);
  expect(decideChange).toHaveBeenCalledExactlyOnceWith(
    company,
    change,
    true,
    'Segunda opção conferida',
    1,
  );
  expect((await screen.findByRole('alert')).textContent).toContain('O horário ficou indisponível.');
  expect(screen.getByText('Remarcação · Em análise')).toBeTruthy();
  expect(within(form).getByRole('option', { selected: true }).getAttribute('value')).toBe('1');
  expect(refresh).not.toHaveBeenCalled();
});
