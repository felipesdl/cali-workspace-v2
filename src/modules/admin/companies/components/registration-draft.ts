import { z } from 'zod';
import {
  registrationValuesSchema,
  logoSchema,
  type RegistrationValues,
} from '../../../../api/admin/companies/registration-schemas';
const optional = z
  .string()
  .trim()
  .transform((value) => value || null);
export const registrationDraftSchema = z
  .strictObject({
    service: optional,
    segment: z.string().trim(),
    monthlyHours: z
      .string()
      .trim()
      .regex(/^$|^\d+(?:[.,]\d+)?$/, 'Use horas sem separador de milhar.')
      .transform((value) => (value ? Number(value.replace(',', '.')) : null)),
    addressStreet: z.string().trim(),
    addressNumber: z.string().trim(),
    neighborhood: z.string().trim(),
    city: z.string().trim(),
    state: z.string().trim().toUpperCase(),
    hasBranches: z
      .string()
      .pipe(z.enum(['yes', 'no']))
      .transform((value) => value === 'yes'),
    branches: z.string().transform((value) =>
      value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    ),
    contactName: z.string().trim(),
    contactJobTitle: z.string().trim(),
    contactEmail: z.string().trim().toLowerCase(),
    contactPhone: z.string().trim(),
    contactWhatsapp: z.string().trim(),
    contactBirthday: optional,
    logo: logoSchema.nullable(),
  })
  .pipe(registrationValuesSchema);
export type RegistrationDraft = z.input<typeof registrationDraftSchema>;
export function registrationToDraft(value: RegistrationValues): RegistrationDraft {
  return {
    ...value,
    service: value.service ?? '',
    monthlyHours: value.monthlyHours === null ? '' : String(value.monthlyHours).replace('.', ','),
    hasBranches: value.hasBranches ? 'yes' : 'no',
    branches: value.branches.join('\n'),
    contactBirthday: value.contactBirthday ?? '',
  };
}
