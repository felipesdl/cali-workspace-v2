import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { catalog } from '../src/api/shared/workspace/schemas';
import { ClientReportReading } from '../src/modules/client/reports/components/ClientReportReading';

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

it('mostra protocolo, versão, publicação e ciência disponíveis no catálogo', () => {
  const data = catalog.parse({
    companyId: '9c5ab148-78b8-4410-9338-58c44222a5db',
    module: 'reports',
    month: null,
    total: 1,
    entries: [
      {
        id: '10000000-0000-4000-8000-000000000003',
        title: 'Fechamento de novembro',
        protocol: 'REL-2026-11-01',
        status: 'published',
        instant: '2026-11-10T15:00:00Z',
        day: '2026-11-01',
        summary: null,
        reportVersion: 2,
        acknowledgmentAvailable: true,
        reportAcknowledged: true,
      },
    ],
  });
  render(
    <ClientReportReading
      company="9c5ab148-78b8-4410-9338-58c44222a5db"
      data={data}
      showList
      page={1}
      select={vi.fn()}
      changePage={vi.fn()}
      toggleList={vi.fn()}
    />,
  );
  expect(screen.getByText('REL-2026-11-01')).toBeTruthy();
  expect(screen.getByText('01/11/2026 · v2')).toBeTruthy();
  expect(screen.getByText('Ciência registrada')).toBeTruthy();
  expect(screen.getByText(/10\/11\/2026/)).toBeTruthy();
});

it('distingue acervo realmente vazio de página sem registros', () => {
  const data = catalog.parse({
    companyId: '9c5ab148-78b8-4410-9338-58c44222a5db',
    module: 'reports',
    month: null,
    total: 0,
    entries: [],
  });
  render(
    <ClientReportReading
      company="9c5ab148-78b8-4410-9338-58c44222a5db"
      data={data}
      showList
      page={1}
      select={vi.fn()}
      changePage={vi.fn()}
      toggleList={vi.fn()}
    />,
  );
  expect(screen.getByText('Nenhum relatório disponível ainda.')).toBeTruthy();
});
