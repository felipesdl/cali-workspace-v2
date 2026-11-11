import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { catalog, workspaceSearch } from '../src/api/shared/workspace/schemas';
import { NoticeCatalogList } from '../src/components/notices/NoticeCatalogList';
import { CommercialResults } from '../src/modules/admin/proposals/CommercialResults';
import { type AdminReadService } from '../src/api/admin/workspace/admin-read';

vi.mock('../src/components/notices/NoticeCover', () => ({
  NoticeCover: () => <div>Imagem do aviso</div>,
}));
vi.mock('../src/components/notices/NoticeInteractions', () => ({
  NoticeInteractions: () => <div>Interações</div>,
}));
vi.mock('../src/components/workspace/CatalogActions', () => ({
  NoticeItemAction: ({ role }: { role?: string }) => (
    <button>{role === 'admin' ? 'Gerir aviso' : 'Confirmar leitura'}</button>
  ),
}));

describe('apresentação de avisos e propostas', () => {
  it('abre comunicado publicado com capa, ciência e interações no contexto do cliente', async () => {
    const user = userEvent.setup();
    const data = catalog.parse({
      companyId: '10000000-0000-4000-8000-000000000001',
      module: 'notices',
      month: null,
      total: 1,
      entries: [
        {
          id: '20000000-0000-4000-8000-000000000001',
          title: 'Recesso de fim de ano',
          protocol: 'AV-2026-010',
          status: 'published',
          instant: '2026-11-10T13:00:00Z',
          day: null,
          summary: 'Atendimento suspenso nos feriados.',
          noticeCoverEnabled: true,
          noticeHasCover: true,
          noticeCoverVersion: '30000000-0000-4000-8000-000000000001',
          noticeAcknowledged: false,
        },
      ],
    });
    function Page() {
      const [search, setSearch] = useState(workspaceSearch.parse({}));
      return (
        <NoticeCatalogList
          data={data}
          company={data.companyId}
          role="client"
          actor="actor"
          search={search}
          update={(change) => setSearch((current) => ({ ...current, ...change }))}
        />
      );
    }
    render(<Page />);
    expect(screen.getByRole('heading', { name: 'Recesso de fim de ano' })).toBeTruthy();
    expect(screen.getByText('Imagem do aviso')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Abrir comunicado' }));
    const detail = within(screen.getByRole('dialog', { name: 'Recesso de fim de ano' }));
    expect(detail.getByText('Interações')).toBeTruthy();
    expect(detail.getByRole('button', { name: 'Confirmar leitura' })).toBeTruthy();
  });

  it('dá destaque à versão e valor comercial sem remover ações controladas pelo contrato', () => {
    const entries: Awaited<ReturnType<AdminReadService['commercial']>>['entries'] = [
      {
        opportunityId: '20000000-0000-4000-8000-000000000001',
        proposalId: '30000000-0000-4000-8000-000000000001',
        protocol: 'PROP-2026-002',
        opportunityStatus: 'edicao',
        service: 'Assessoria',
        package: 'COMPLETO',
        proposalStatus: 'rascunho',
        version: 2,
        total: 12500,
        updatedAt: '2026-11-10T13:00:00Z',
        canCreate: false,
        canSend: false,
        canEmail: false,
      },
    ];
    render(<CommercialResults entries={entries} />);
    expect(screen.getByRole('heading', { name: 'Em edição' })).toBeTruthy();
    expect(screen.getByText('Rascunho · Versão 2')).toBeTruthy();
    expect(screen.getByText('Assessoria · COMPLETO')).toBeTruthy();
    expect(screen.getByText(/12\.500,00/)).toBeTruthy();
  });
});
