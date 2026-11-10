import { describe, expect, it } from 'vitest';
import { monthlyFields } from '../src/api/shared/team/monthly';
import { monthlyIndicators } from '../src/components/team/monthly-indicators';

const fields = monthlyFields.parse({
  planned_hours: 120,
  absence_medical_hours: 4,
  absence_leave_hours: null,
  absence_unjustified_hours: null,
  absence_accident_hours: 2,
  overtime_hours: 0,
  hour_bank_balance: -2,
  approved_headcount: {},
  enps_score: null,
  climate_score: null,
  climate_participation: null,
  notes: null,
});
describe('indicadores mensais da referência', () => {
  it('preserva as fórmulas de saídas/quadro ativo e ausências/horas previstas', () => {
    const result = monthlyIndicators(fields, { active: 8, admissions: 3, exits: 2, moves: 1 });
    expect(result.turnover).toBe(25);
    expect(result.absenteeism).toBe(5);
    expect(result.net).toBe(1);
  });
  it('mantém a falta de confirmação e de denominador explícitas', () => {
    expect(monthlyIndicators(null, null)).toMatchObject({
      active: null,
      admissions: null,
      turnover: null,
      absenteeism: null,
    });
    expect(monthlyIndicators({ ...fields, planned_hours: null }, null).absenteeism).toBeNull();
    expect(monthlyIndicators({ ...fields, planned_hours: 0 }, null).absenteeism).toBeNull();
    expect(
      monthlyIndicators(fields, { active: 0, admissions: 0, exits: 0, moves: 0 }).turnover,
    ).toBe(0);
  });
});
