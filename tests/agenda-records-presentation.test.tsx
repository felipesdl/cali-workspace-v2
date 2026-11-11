import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { catalog, workspaceSearch } from '../src/api/shared/workspace/schemas';
import { AgendaList } from '../src/components/agenda/AgendaList';
import { RecordCatalogList } from '../src/components/records/RecordCatalogList';

const company = '9c5ab148-78b8-4410-9338-58c44222a5db';

describe('apresentação de Agenda e Ocorrências', () => {
  it('mantém eventos de dia inteiro no agrupamento de agenda', () => {
    const data = catalog.parse({
      companyId: company,
      module: 'calendar',
      month: '2026-11-01',
      total: 2,
      entries: [
        {
          id: '10000000-0000-4000-8000-000000000001',
          title: 'Reunião',
          instant: '2026-11-10T13:00:00Z',
          day: null,
          status: 'meeting',
          protocol: null,
          summary: null,
        },
        {
          id: '10000000-0000-4000-8000-000000000002',
          title: 'Aviso do dia',
          instant: null,
          day: '2026-11-10',
          status: 'published',
          protocol: 'AV-01',
          summary: 'Atendimento normal.',
        },
      ],
    });

    render(
      <AgendaList
        data={data}
        search={workspaceSearch.parse({ month: data.month })}
        update={vi.fn()}
      />,
    );

    expect(screen.getByText('Aviso do dia')).toBeTruthy();
    expect(screen.getByText('Dia inteiro')).toBeTruthy();
    expect(screen.getAllByText('Reunião')).toHaveLength(2);
  });

  it('ordena o grupo pelo dia de Brasília mesmo quando o horário UTC muda de data', () => {
    const data = catalog.parse({
      companyId: company,
      module: 'calendar',
      month: '2026-11-01',
      total: 2,
      entries: [
        {
          id: '10000000-0000-4000-8000-000000000003',
          title: 'Todo o dia seguinte',
          instant: null,
          day: '2026-11-11',
          status: 'published',
          protocol: null,
          summary: null,
        },
        {
          id: '10000000-0000-4000-8000-000000000004',
          title: 'Evento na noite anterior',
          instant: '2026-11-11T01:00:00Z',
          day: null,
          status: 'meeting',
          protocol: null,
          summary: null,
        },
      ],
    });
    render(
      <AgendaList
        data={data}
        search={workspaceSearch.parse({ month: data.month })}
        update={vi.fn()}
      />,
    );
    const days = screen.getAllByRole('region');
    expect(days[0].getAttribute('aria-label')).toContain('10 de novembro de 2026');
    expect(days[1].getAttribute('aria-label')).toContain('11 de novembro de 2026');
  });

  it('abre a conversa pelo ID da ocorrência da página atual', async () => {
    const user = userEvent.setup();
    const record = '10000000-0000-4000-8000-000000000001';
    const update = vi.fn();
    const data = catalog.parse({
      companyId: company,
      module: 'records',
      month: null,
      total: 1,
      entries: [
        {
          id: record,
          title: 'Solicitação de ajuste',
          protocol: 'OC-01',
          status: 'in_progress',
          instant: '2026-11-10T13:00:00Z',
          day: null,
          summary: 'Revisar entrega.',
        },
      ],
    });

    render(
      <RecordCatalogList
        data={data}
        role="client"
        canOpenConversation
        search={workspaceSearch.parse({})}
        update={update}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Solicitação de ajuste' })).toBeTruthy();
    expect(screen.getByText('Em atendimento')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Abrir conversa' }));
    expect(update).toHaveBeenCalledExactlyOnceWith({ record });
  });

  it('não oferece conversa quando as operações de domínio não estão disponíveis', () => {
    const data = catalog.parse({
      companyId: company,
      module: 'records',
      month: null,
      total: 1,
      entries: [
        {
          id: '10000000-0000-4000-8000-000000000005',
          title: 'Ocorrência em leitura',
          protocol: 'OC-02',
          status: 'in_progress',
          instant: null,
          day: null,
          summary: null,
        },
      ],
    });
    render(
      <RecordCatalogList
        data={data}
        role="admin"
        canOpenConversation={false}
        search={workspaceSearch.parse({})}
        update={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Abrir conversa' })).toBeNull();
  });
});
