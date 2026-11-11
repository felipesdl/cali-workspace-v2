import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HourCapacity } from '../src/components/hours/HoursWorkspace';
import { AgendaList } from '../src/components/agenda/AgendaList';
import { catalog, workspaceSearch } from '../src/api/shared/workspace/schemas';

describe('apresentações de Operação', () => {
  it('ordena agenda por data e agrupa itens no dia de Brasília', () => {
    const data = catalog.parse({
      companyId: '10000000-0000-4000-8000-000000000001',
      module: 'calendar',
      month: '2026-11-01',
      total: 2,
      entries: [
        {
          id: '20000000-0000-4000-8000-000000000002',
          title: 'Reunião posterior',
          status: 'meeting',
          instant: '2026-11-10T17:00:00Z',
          protocol: null,
          day: null,
          summary: null,
        },
        {
          id: '20000000-0000-4000-8000-000000000001',
          title: 'Reunião anterior',
          status: 'meeting',
          instant: '2026-11-10T13:00:00Z',
          protocol: null,
          day: null,
          summary: null,
        },
      ],
    });
    render(<AgendaList data={data} search={workspaceSearch.parse({})} update={vi.fn()} />);
    const entries = screen.getAllByRole('listitem');
    expect(within(entries[0]).getByText('Reunião anterior')).toBeTruthy();
    expect(within(entries[1]).getByText('Reunião posterior')).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
  });

  it('mostra percentual da capacidade sem cortar excedente do texto', () => {
    render(
      <HourCapacity
        contractedMinutes={600}
        consumedMinutes={720}
        remainingMinutes={0}
        overMinutes={120}
      />,
    );
    const progress = screen.getByRole('progressbar', {
      name: 'Consumo da capacidade mensal contratada',
    });
    expect(progress.getAttribute('value')).toBe('100');
    expect(progress.getAttribute('aria-valuetext')).toBe('120% consumido');
    expect(screen.getByText('120% da franquia consumida')).toBeTruthy();
  });
});
