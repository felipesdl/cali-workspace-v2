import { describe, expect, it } from 'vitest';
import { discManagementSchema, discPublicProjectionSchema } from '../src/api/shared/disc/schemas';

const qualitativeManagement = {
  id: 'f947c5a0-6c02-4494-8c67-31adab0fd28e',
  title: 'Campanha de teste',
  organization: 'Empresa de teste',
  goal: null,
  note: null,
  moment: null,
  sector: null,
  mode: 'qualitative',
  sample_size: null,
  distribution: null,
  quantitative: null,
  qualitative: { dominant: 'Leitura agregada.', pressure: 'Leitura sob pressão.' },
  approved_at: null,
  released_at: null,
  protocol: null,
  signer: null,
  revision: 1,
} as const;

describe('DISC management contract', () => {
  it('preserves a null quantitative projection for protected or qualitative reports', () => {
    const parsed = discManagementSchema.parse(qualitativeManagement);

    expect(parsed.quantitative).toBeNull();
  });

  it('rejects respondent identity keys inside quantitative aggregates', () => {
    const parsed = discManagementSchema.safeParse({
      ...qualitativeManagement,
      mode: 'quantitative',
      sample_size: 15,
      distribution: { D: 5, I: 4, S: 3, C: 3 },
      quantitative: {
        secondary: {
          D: 5,
          I: 4,
          S: 3,
          C: 3,
          respondent_email: 'respondent@example.test',
        },
        mixed: 4,
        bands: {
          D: { low: 2, mid: 2, high: 1 },
          I: { low: 1, mid: 2, high: 1 },
          S: { low: 1, mid: 1, high: 1 },
          C: { low: 1, mid: 1, high: 1 },
        },
        pressure: {
          stable: 8,
          one: 5,
          many: 2,
          up: { D: 2, I: 2, S: 1, C: 0 },
          down: { D: 0, I: 1, S: 2, C: 2 },
        },
      },
    });

    expect(parsed.success).toBe(false);
  });
});

describe('DISC projection pública', () => {
  it('retorna apenas contexto do convite e não aceita respostas ou resultado individual', () => {
    const projection = {
      state: 'started',
      title: 'Campanha sintética',
      organization: 'Organização sintética',
      person_name: 'Respondente sintético',
      deadline_at: '2026-11-17T23:59:59-03:00',
      last_block: 7,
    } as const;

    expect(discPublicProjectionSchema.parse(projection)).toEqual(projection);
    expect(
      discPublicProjectionSchema.safeParse({
        ...projection,
        answers: { natural: [], pressure: [] },
        result: { primary_style: 'D', scores: {} },
      }).success,
    ).toBe(false);
  });
});
