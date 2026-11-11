import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createQueryClient } from '../src/api/query-client';
import { type CatalogModule } from '../src/api/shared/workspace/schemas';
import { ClientOperationsOverview } from '../src/modules/client/home/components/ClientOperationsOverview';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
  useRouteContext: () => ({ adminRead: null }),
}));

const companyId = '00000000-0000-4000-8000-000000000001';

it('organiza contratação, três indicadores, agenda, avisos e equipe sem inventar plano ou satisfação', async () => {
  const service = {
    list: async () => ({ companyId, total: 0, projects: [] }),
    hours: async (_company: string, month: string) => ({
      companyId,
      month,
      visible: false as const,
    }),
    catalog: async (_company: string, module: CatalogModule, month: string | null) => ({
      companyId,
      module,
      month: module === 'calendar' ? month : null,
      total: 0,
      entries: [],
    }),
    detail: async () => null,
  };
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ClientOperationsOverview
        service={service}
        company={companyId}
        account={{
          id: companyId,
          displayName: 'Empresa Exemplo',
          legalName: 'Empresa Exemplo',
          plan: 'partner',
          status: 'active',
        }}
        canOpenRecord={false}
        teamOverview={
          <section aria-labelledby="team-title">
            <h2 id="team-title">Equipe da sua empresa</h2>
          </section>
        }
      />
    </QueryClientProvider>,
  );

  const contract = within(await screen.findByRole('region', { name: 'Sua contratação' }));
  expect(contract.getByRole('link', { name: 'Empresa Exemplo' }).getAttribute('href')).toBe(
    '/cliente/empresa',
  );
  expect(contract.getByText('CALI Partner · Ativa')).toBeTruthy();
  expect(contract.queryByText(/Plano/)).toBeNull();
  expect(screen.getByRole('heading', { name: 'Entregas do ciclo' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: /Percepção do trabalho/ })).toBeTruthy();
  expect(screen.getByRole('heading', { name: /Conclusão do trabalho/ })).toBeTruthy();
  expect(
    await screen.findByText('Métrica de satisfação indisponível nos relatórios publicados.'),
  ).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Agenda compartilhada' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Avisos da sua parceria' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Equipe da sua empresa' })).toBeTruthy();
});
