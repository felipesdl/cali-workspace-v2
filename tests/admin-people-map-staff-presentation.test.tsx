import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { createQueryClient } from '../src/api/query-client';
import { MapaJourneys } from '../src/modules/admin/people-map/components/MapaJourneys';
import { staffModuleLabels } from '../src/modules/admin/staff/staff-module-labels';

it('apresenta a jornada com colunas de auditoria e situação legível', async () => {
  const service = {
    mapaJourneys: async () => ({
      companyId: '00000000-0000-4000-8000-000000000001',
      total: 1,
      entries: [
        {
          id: 'a'.repeat(64),
          accessedAt: '2026-11-10T12:00:00Z',
          lastSeenAt: '2026-11-10T12:10:00Z',
          step: 3,
          started: true,
          copies: 2,
          device: 'Desktop',
          referrer: null,
          status: 'in_progress' as const,
        },
      ],
    }),
  };
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MapaJourneys company="00000000-0000-4000-8000-000000000001" service={service} />
    </QueryClientProvider>,
  );
  const region = await screen.findByRole('region', { name: 'Tabela de jornadas' });
  const table = within(region).getByRole('table');
  expect(within(table).getByRole('columnheader', { name: 'Último sinal' })).toBeTruthy();
  expect(within(table).getByText('Etapa 3 de 7')).toBeTruthy();
  expect(within(table).getByText('Em andamento')).toBeTruthy();
  expect(within(table).getByText('Acesso direto')).toBeTruthy();
});

it('reaproveita nomes do catálogo CALI nos módulos da equipe', () => {
  expect(staffModuleLabels.records).toBe('Ocorrências');
  expect(staffModuleLabels.people_map).toBe('Mapa de People');
});
