import { describe, expect, it } from 'vitest';
import { formatCalendarDate } from '../src/lib/dates';

describe('datas civis', () => {
  it('preserva o dia sem converter meia-noite UTC para a véspera', () => {
    expect(formatCalendarDate('2026-10-01')).toBe('01/10/2026');
    expect(formatCalendarDate('2024-02-29')).toBe('29/02/2024');
  });
  it.each(['2026-02-30', '2026-10-01T00:00:00Z', '', '01/10/2026'])(
    'não apresenta data inválida: %s',
    (date) => {
      expect(formatCalendarDate(date)).toBe('Data indisponível');
    },
  );
});
