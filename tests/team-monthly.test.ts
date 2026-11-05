import { describe, expect, it } from 'vitest';
import { monthlyFields } from '../src/api/modules/team/monthly';

const empty = {
  planned_hours: null,
  absence_medical_hours: null,
  absence_leave_hours: null,
  absence_unjustified_hours: null,
  absence_accident_hours: null,
  overtime_hours: null,
  hour_bank_balance: null,
  approved_headcount: {},
  enps_score: null,
  climate_score: null,
  climate_participation: null,
  notes: null,
};

describe('dados mensais', () => {
  it('preserva ausência de informação e saldo negativo do banco', () => {
    const result = monthlyFields.parse({ ...empty, hour_bank_balance: -12.5, planned_hours: 0 });
    expect(result.absence_medical_hours).toBeNull();
    expect(result.planned_hours).toBe(0);
    expect(result.hour_bank_balance).toBe(-12.5);
  });
  it('recusa contagens fracionadas e valores fora das escalas', () => {
    expect(
      monthlyFields.safeParse({ ...empty, approved_headcount: { Operações: 2.5 } }).success,
    ).toBe(false);
    expect(monthlyFields.safeParse({ ...empty, climate_score: 10.1 }).success).toBe(false);
    expect(monthlyFields.safeParse({ ...empty, enps_score: 101 }).success).toBe(false);
    expect(monthlyFields.safeParse({ ...empty, absence_leave_hours: -1 }).success).toBe(false);
  });
});
