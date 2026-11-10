import { z } from 'zod';

export const gender = {
  Female: 'female',
  Male: 'male',
  Other: 'other',
  PreferNot: 'prefer_not',
} as const;
export const children = { Yes: 'yes', No: 'no', PreferNot: 'prefer_not' } as const;
export const teamPrivateValues = z.object({
  salary: z.number().min(0).max(9_999_999_999.99).nullable(),
  salary_review_date: z.iso.date().nullable(),
  gender: z.enum(gender).nullable(),
  gender_detail: z.string().trim().max(120).nullable(),
  has_children: z.enum(children).nullable(),
});
export const teamPrivateRecord = teamPrivateValues.extend({
  member_id: z.uuid(),
  company_id: z.uuid(),
  updated_at: z.iso.datetime({ offset: true }).nullable(),
});
export type TeamPrivateValues = z.infer<typeof teamPrivateValues>;
export type TeamPrivateRecord = z.infer<typeof teamPrivateRecord>;

export function privateValuesFromForm(form: FormData) {
  const salary = form.get('salary');
  const identity = form.get('gender') || null;
  return teamPrivateValues.parse({
    salary: typeof salary === 'string' && salary !== '' ? Number(salary) : null,
    salary_review_date: form.get('salary_review_date') || null,
    gender: identity,
    gender_detail: identity === gender.Other ? form.get('gender_detail') || null : null,
    has_children: form.get('has_children') || null,
  });
}
