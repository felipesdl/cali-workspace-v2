import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { catalog } from '../src/api/shared/workspace/schemas';
import { AdminReportWorkspace } from '../src/modules/admin/reports/components/AdminReportWorkspace';

describe('leitura Admin de relatórios', () => {
  it('organiza fechamento, etapa e histórico sem perder a seleção', () => {
    const data = catalog.parse({
      companyId: '9c5ab148-78b8-4410-9338-58c44222a5db',
      module: 'reports',
      month: null,
      total: 1,
      entries: [
        {
          id: '10000000-0000-4000-8000-000000000001',
          title: 'Fechamento mensal',
          protocol: 'REL-2026-11',
          status: 'review',
          instant: null,
          day: '2026-11-01',
          summary: 'Síntese do período.',
        },
      ],
    });
    render(
      <AdminReportWorkspace
        company="9c5ab148-78b8-4410-9338-58c44222a5db"
        data={data}
        page={1}
        select={vi.fn()}
        changePage={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Fechamento mensal' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Etapa do fechamento' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Histórico de relatórios' })).toBeTruthy();
    expect(screen.getByText(/REL-2026-11/)).toBeTruthy();
  });

  it('não substitui relatório selecionado fora da página pelo primeiro item', () => {
    const data = catalog.parse({
      companyId: '9c5ab148-78b8-4410-9338-58c44222a5db',
      module: 'reports',
      month: null,
      total: 26,
      entries: [
        {
          id: '10000000-0000-4000-8000-000000000001',
          title: 'Relatório recente',
          protocol: null,
          status: 'draft',
          instant: null,
          day: '2026-11-01',
          summary: 'Resumo recente',
        },
      ],
    });

    render(
      <AdminReportWorkspace
        company="9c5ab148-78b8-4410-9338-58c44222a5db"
        data={data}
        page={1}
        report="10000000-0000-4000-8000-000000000026"
        select={vi.fn()}
        changePage={vi.fn()}
      />,
    );

    expect(screen.getByText('O relatório selecionado não aparece nesta página.')).toBeTruthy();
    expect(screen.queryByText('Resumo recente')).toBeNull();
  });
});
