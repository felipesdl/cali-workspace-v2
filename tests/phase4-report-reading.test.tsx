import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { catalog } from '../src/api/modules/project-workspace/schemas';
import { ClientReportReading } from '../src/features/project-workspace/ClientReportReading';

it('mostra uma leitura por vez e abre o relatório escolhido no arquivo sem dar ciência', async () => {
  const company = '9c5ab148-78b8-4410-9338-58c44222a5db';
  const first = '10000000-0000-4000-8000-000000000001';
  const second = '10000000-0000-4000-8000-000000000002';
  const data = catalog.parse({
    companyId: company,
    module: 'reports',
    month: null,
    total: 2,
    entries: [
      { id: first, title: 'Relatório recente', day: '2026-11-01' },
      { id: second, title: 'Relatório anterior', day: '2026-10-01' },
    ].map((entry) => ({ ...entry, protocol: null, status: null, instant: null, summary: null })),
  });
  const select = vi.fn();
  const toggleList = vi.fn();
  const props = { company, data, page: 1, select, toggleList, changePage: vi.fn() };
  const { rerender } = render(<ClientReportReading {...props} showList={false} />);

  expect(screen.getByRole('heading', { name: 'Relatório recente' })).toBeTruthy();
  expect(screen.queryByText('Relatório anterior')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Todos os relatórios' }));
  expect(toggleList).toHaveBeenCalledWith(true);

  rerender(<ClientReportReading {...props} showList />);
  await userEvent.click(screen.getAllByRole('button', { name: 'Abrir relatório' })[1]);
  expect(select).toHaveBeenCalledWith(second);

  rerender(<ClientReportReading {...props} report={second} showList={false} />);
  expect(screen.getByRole('heading', { name: 'Relatório anterior' })).toBeTruthy();
  expect(screen.queryByText('Relatório recente')).toBeNull();
});
