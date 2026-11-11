import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { SatisfactionSummary } from '../src/modules/admin/satisfaction/components/SatisfactionSummary';

it('mostra indicadores, distribuição e tendências do período sem omitir avaliações positivas', () => {
  render(
    <SatisfactionSummary
      accountSelected
      value={{
        average: 4,
        total: 3,
        distribution: [
          { score: 1, total: 0 },
          { score: 2, total: 1 },
          { score: 3, total: 0 },
          { score: 4, total: 1 },
          { score: 5, total: 1 },
        ],
        trend: [
          { month: '2026-10-01', total: 1, average: 2, attention: 1, positive: 0 },
          { month: '2026-11-01', total: 2, average: 5, attention: 0, positive: 2 },
        ],
      }}
    />,
  );
  expect(screen.getByText('4,0/5')).toBeTruthy();
  expect(screen.getByText('67%')).toBeTruthy();
  expect(screen.getByText('Como as notas estão concentradas')).toBeTruthy();
  const trend = within(screen.getByRole('table'));
  expect(trend.getByText('out. de 2026')).toBeTruthy();
  expect(trend.getByText('nov. de 2026')).toBeTruthy();
  const rows = [...screen.getByRole('table').querySelectorAll('tbody tr')];
  expect([...rows[0].querySelectorAll('td')].map((cell) => cell.textContent).join('|')).toBe(
    '2,0/5|1|1|0',
  );
  expect([...rows[1].querySelectorAll('td')].map((cell) => cell.textContent).join('|')).toBe(
    '5,0/5|2|0|2',
  );
});
