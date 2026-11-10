import { z } from 'zod';
import {
  administrationValuesSchema,
  type AdministrationValues,
} from '../../../../api/admin/companies/administration-schemas';

const decimal = z
  .string()
  .trim()
  .regex(/^$|^\d+(?:[.,]\d+)?$/, 'Use um número sem separador de milhar.')
  .transform((value) => (value ? Number(value.replace(',', '.')) : null));
const money = z
  .string()
  .trim()
  .regex(/^$|^\d+(?:[.,]\d{1,2})?$/, 'Use até duas casas decimais, sem separador de milhar.')
  .transform((value) => (value ? Number(value.replace(',', '.')) : null));
const integer = z
  .string()
  .trim()
  .regex(/^\d*$/, 'Informe um número inteiro.')
  .transform((value) => (value ? Number(value) : null));
const optional = z
  .string()
  .trim()
  .transform((value) => value || null);
const boolean = z.enum(['yes', 'no']).transform((value) => value === 'yes');
// Booleanos também são strings no rascunho, consumidos por selects de opções fechadas.
const yesNo = z.string().pipe(boolean);
export const administrationDraftSchema = z
  .strictObject({
    startDate: optional,
    endDate: optional,
    contractType: optional,
    contractModel: optional,
    autoRenew: yesNo,
    penaltyEnabled: yesNo,
    penaltyBase: z.string(),
    penaltyValue: decimal,
    terminationPaymentDays: integer,
    terminationPaymentRule: z.string(),
    penaltyText: z.string().trim(),
    contractValue: money,
    billingFrequency: optional,
    paymentMethod: optional,
    billingDueRule: optional,
    billingDay: integer,
    billingLeadDays: integer,
    paymentTermDays: integer,
    lateFeePercent: decimal,
    dailyInterestPercent: decimal,
    financialNote: z.string().trim(),
    driveUrl: z.string().trim(),
    documentOwner: z.string().trim(),
    documentNotes: z.string().trim(),
  })
  .pipe(administrationValuesSchema);
export type AdministrationDraft = z.input<typeof administrationDraftSchema>;

export function administrationToDraft(value: AdministrationValues): AdministrationDraft {
  const number = (value: number | null) => (value === null ? '' : String(value).replace('.', ','));
  return {
    startDate: value.startDate ?? '',
    endDate: value.endDate ?? '',
    contractType: value.contractType ?? '',
    contractModel: value.contractModel ?? '',
    autoRenew: value.autoRenew ? 'yes' : 'no',
    penaltyEnabled: value.penaltyEnabled ? 'yes' : 'no',
    penaltyBase: value.penaltyBase,
    penaltyValue: number(value.penaltyValue),
    terminationPaymentDays: number(value.terminationPaymentDays),
    terminationPaymentRule: value.terminationPaymentRule,
    penaltyText: value.penaltyText,
    contractValue: number(value.contractValue),
    billingFrequency: value.billingFrequency ?? '',
    paymentMethod: value.paymentMethod ?? '',
    billingDueRule: value.billingDueRule ?? '',
    billingDay: number(value.billingDay),
    billingLeadDays: number(value.billingLeadDays),
    paymentTermDays: number(value.paymentTermDays),
    lateFeePercent: number(value.lateFeePercent),
    dailyInterestPercent: number(value.dailyInterestPercent),
    financialNote: value.financialNote,
    driveUrl: value.driveUrl,
    documentOwner: value.documentOwner,
    documentNotes: value.documentNotes,
  };
}
