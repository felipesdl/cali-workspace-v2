import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { createQueryClient } from '../src/api/query-client';
import { type ProjectDetail } from '../src/api/shared/workspace/schemas';
import { type ProjectAction } from '../src/api/shared/workspace/operations';
import { EditPlanItem, ScheduleItemRequest } from '../src/components/projects/ProjectPlanning';

const context = vi.hoisted(() => ({
  operate: vi.fn<(company: string, action: ProjectAction) => Promise<string>>(),
  detail: vi.fn<() => Promise<ProjectDetail | null>>(),
}));
vi.mock('@tanstack/react-router', () => ({
  useRouteContext: () => ({
    projectOperations: context.operate,
    projectWorkspace: { detail: context.detail },
  }),
}));

const scope = {
  company: '9c5ab148-78b8-4410-9338-58c44222a5db',
  actor: 'admin',
  project: '10000000-0000-4000-8000-000000000001',
};
const delivery = {
  id: '20000000-0000-4000-8000-000000000001',
  name: 'Entrega sintética',
  protocol: 'DEL-QA',
  status: 'not_started',
  execution_status: 'normal',
  due_at: '2026-11-12T19:00:00Z',
  updated_at: '2026-11-07T00:00:00Z',
  complexity: 'MC2',
  sort_order: 1,
  workstream_id: null,
} satisfies ProjectDetail['items']['rows'][number];
const emptyDetail = {
  companyId: scope.company,
  project: {
    id: scope.project,
    name: 'Projeto',
    protocol: null,
    planning_status: 'draft',
    execution_status: 'normal',
    roadmap_start_date: '2026-11-09',
    roadmap_end_date: null,
    description: null,
  },
  review: null,
  items: { total: 0, rows: [] },
} satisfies ProjectDetail;

it('edita em Brasília e preserva os campos após conflito, sem refazer a mutação', async () => {
  const user = userEvent.setup();
  context.detail.mockResolvedValue(emptyDetail);
  context.operate.mockRejectedValueOnce(new Error('O registro mudou. Recarregue o planejamento.'));
  render(
    <QueryClientProvider client={createQueryClient()}>
      <EditPlanItem scope={scope} item={delivery} section="deliverables" draft />
    </QueryClientProvider>,
  );
  await user.click(screen.getByText('Editar Entrega sintética'));
  const form = screen.getByRole('form', { name: 'Salvar item do planejamento' });
  expect(within(form).getByLabelText('Prazo em horário de Brasília')).toHaveProperty(
    'value',
    '2026-11-12T16:00',
  );
  const name = within(form).getByLabelText('Nome do item');
  await user.clear(name);
  await user.type(name, 'Nome revisado');
  await user.click(within(form).getByRole('button', { name: 'Salvar item do planejamento' }));
  expect((await screen.findByRole('alert')).textContent).toContain('O registro mudou.');
  expect(name).toHaveProperty('value', 'Nome revisado');
  expect(context.operate).toHaveBeenCalledExactlyOnceWith(
    scope.company,
    expect.objectContaining({
      item: delivery.id,
      expected: delivery.updated_at,
      due: '2026-11-12T16:00',
      name: 'Nome revisado',
    }),
  );
});

it('oferece somente outro entregável de mesma complexidade para troca', async () => {
  const user = userEvent.setup();
  context.operate.mockResolvedValue(scope.project);
  context.detail.mockResolvedValue({
    ...emptyDetail,
    items: {
      total: 3,
      rows: [
        delivery,
        { ...delivery, id: '20000000-0000-4000-8000-000000000002', name: 'Equivalente' },
        {
          ...delivery,
          id: '20000000-0000-4000-8000-000000000003',
          name: 'Outra complexidade',
          complexity: 'MC1',
        },
      ],
    },
  });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ScheduleItemRequest
        scope={scope}
        item={delivery}
        section="deliverables"
        review={scope.project}
      />
    </QueryClientProvider>,
  );
  await user.click(screen.getByText('Pedir ajuste em Entrega sintética'));
  await user.selectOptions(screen.getByLabelText('Ajuste solicitado'), 'swap_order');
  const select = await screen.findByLabelText('Entregável de mesma complexidade');
  expect(await within(select).findByRole('option', { name: 'Equivalente' })).toBeTruthy();
  expect(within(select).queryByRole('option', { name: 'Entrega sintética' })).toBeNull();
  expect(within(select).queryByRole('option', { name: 'Outra complexidade' })).toBeNull();
  await user.selectOptions(select, '20000000-0000-4000-8000-000000000002');
  await user.type(screen.getByLabelText('Descreva o ajuste'), 'Priorizar a outra entrega');
  await user.click(screen.getByRole('button', { name: 'Enviar pedido de ajuste do item' }));
  expect((await screen.findByRole('status')).textContent).toContain('Operação concluída.');
  expect(context.operate).toHaveBeenLastCalledWith(
    scope.company,
    expect.objectContaining({
      targetType: 'deliverable',
      target: delivery.id,
      itemAction: 'swap_order',
      swap: '20000000-0000-4000-8000-000000000002',
    }),
  );
});

it('mantém frente vinculada quando a lista assíncrona substitui a opção provisória', async () => {
  const user = userEvent.setup();
  const front = '30000000-0000-4000-8000-000000000001';
  let finish: (result: ProjectDetail) => void = () => {
    throw new Error('Consulta não iniciou');
  };
  context.detail.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  context.operate.mockResolvedValue(delivery.id);
  render(
    <QueryClientProvider client={createQueryClient()}>
      <EditPlanItem
        scope={scope}
        item={{ ...delivery, workstream_id: front }}
        section="deliverables"
        draft
      />
    </QueryClientProvider>,
  );
  await user.click(screen.getByText('Editar Entrega sintética'));
  const select = screen.getByLabelText('Frente do entregável');
  expect(select).toHaveProperty('value', front);
  await act(async () => {
    finish({
      ...emptyDetail,
      items: { total: 1, rows: [{ ...delivery, id: front, name: 'Frente existente' }] },
    });
  });
  expect(await within(select).findByRole('option', { name: 'Frente existente' })).toBeTruthy();
  expect(select).toHaveProperty('value', front);
  await user.click(screen.getByRole('button', { name: 'Salvar item do planejamento' }));
  expect(context.operate).toHaveBeenLastCalledWith(
    scope.company,
    expect.objectContaining({ workstream: front }),
  );
});
