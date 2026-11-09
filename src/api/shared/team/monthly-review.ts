import { z } from 'zod';

export const vacancyStatus = { Open: 'open', Filled: 'filled', Cancelled: 'cancelled' } as const;
export const monthlyVacancy = z
  .strictObject({
    vacancy_code: z.string().trim().min(1).max(80),
    title: z.string().trim().min(2).max(180),
    department: z.string().trim().max(180).nullable(),
    opened_on: z.iso.date(),
    status: z.enum(vacancyStatus),
    closed_on: z.iso.date().nullable(),
  })
  .refine(
    (row) =>
      row.status === vacancyStatus.Open
        ? row.closed_on === null
        : Boolean(row.closed_on && row.closed_on >= row.opened_on),
    'Confira a situação e o encerramento da vaga.',
  );
export type MonthlyVacancy = z.infer<typeof monthlyVacancy>;
export const monthlyReviewState = z.object({
  companyId: z.uuid(),
  referenceMonth: z.iso.date(),
  token: z.string().regex(/^[0-9a-f]{64}$/),
  draftPeople: z.number().int().nonnegative(),
  vacancyTotal: z.number().int().nonnegative(),
  summary: z
    .object({
      active: z.number().int().nonnegative(),
      admissions: z.number().int().nonnegative(),
      exits: z.number().int().nonnegative(),
      moves: z.number().int().nonnegative(),
    })
    .nullable(),
  vacancies: z.array(monthlyVacancy).max(200),
  series: z
    .array(
      z.object({
        reference_month: z.iso.date(),
        revision: z.number().int().positive(),
        confirmed_at: z.iso.datetime({ offset: true }),
        active: z.number().int().nonnegative(),
        admissions: z.number().int().nonnegative(),
        exits: z.number().int().nonnegative(),
        moves: z.number().int().nonnegative(),
      }),
    )
    .max(12),
});
export type MonthlyReviewState = z.infer<typeof monthlyReviewState>;
export type ReviewCommand = {
  companyId: string;
  month: string;
  token: string;
  vacancies: MonthlyVacancy[];
  reason: string;
  requestId: string;
};
