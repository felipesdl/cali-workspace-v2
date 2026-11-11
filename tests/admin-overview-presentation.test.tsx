import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminOverviewSnapshot } from '../src/api/admin/workspace/admin-portfolio';
import { companySchema } from '../src/api/admin/companies/schemas';
import { AdminOverviewSnapshot } from '../src/modules/admin/overview/components/AdminOverviewSnapshot';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a>,
  useRouteContext: () => ({ projectWorkspace: {}, adminRead: {} }),
}));
vi.mock('../src/api/access/hooks/useOwnProfileQuery', () => ({
  useOwnProfileQuery: () => ({ query: { isSuccess: true, data: { full_name: 'Patrícia Silva' } } }),
}));

describe('apresentação da visão geral Admin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('compõe indicadores, execução visual, satisfação, prazos e carteira com dados V2', () => {
    const companyId = '9c5ab148-78b8-4410-9338-58c44222a5db';
    const data = adminOverviewSnapshot.parse({
      companyId: null,
      month: '2026-11-01',
      activeAccounts: 1,
      pendingActions: 1,
      hoursMinutes: 90,
      contractedMinutes: 120,
      hoursByCompany: [{ companyId, name: 'Conta Atlas', minutes: 90, contractedMinutes: 120 }],
      priorities: [
        {
          id: '10000000-0000-4000-8000-000000000001',
          companyId,
          title: 'Revisar escopo',
          kind: 'project',
        },
      ],
      agenda: [
        {
          id: '20000000-0000-4000-8000-000000000001',
          companyId,
          title: 'Reunião mensal',
          startsAt: '2026-11-12T14:00:00Z',
        },
      ],
      deliverables: [
        { status: 'in_progress', total: 2 },
        { status: 'approved', total: 1 },
      ],
      deadlines: [
        {
          id: '30000000-0000-4000-8000-000000000001',
          companyId,
          projectId: null,
          title: 'Entrega da campanha',
          dueOn: '2026-11-14',
        },
      ],
      satisfaction: {
        average: 4,
        total: 2,
        distribution: [
          { score: 1, total: 0 },
          { score: 2, total: 0 },
          { score: 3, total: 0 },
          { score: 4, total: 2 },
          { score: 5, total: 0 },
        ],
      },
    });
    const companies = [
      companySchema.parse({
        id: companyId,
        displayName: 'Conta Atlas',
        legalName: 'Conta Atlas Ltda',
        status: 'active',
        plan: 'full',
        createdOn: '2026-01-01',
      }),
    ];

    render(<AdminOverviewSnapshot data={data} scope="Todas as contas" companies={companies} />);

    expect(screen.getByRole('heading', { name: /Patrícia\./ })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Indicadores operacionais' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Status dos entregáveis' })).toBeTruthy();
    expect(screen.getByRole('img')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Carteira de clientes' })).toBeTruthy();
    expect(
      within(
        screen.getByRole('heading', { name: 'Carteira de clientes' }).closest('section')!,
      ).getByText('Conta Atlas'),
    ).toBeTruthy();
    expect(screen.getByText('Entrega da campanha')).toBeTruthy();
  });
});
