import { z } from 'zod';

export const contractType = { Partner: 'CALI Partner', Full: 'CALI Full', Other: 'Outro' } as const;
export const contractModel = {
  Advisory: 'Assessoria mensal',
  Project: 'Projeto',
  Training: 'Treinamento',
} as const;
export const penaltyBase = {
  TextOnly: 'none',
  RemainingBalance: 'remaining_balance_percent',
  ContractTotal: 'contract_total_percent',
  FixedAmount: 'fixed_amount',
  MonthlyMultiple: 'monthly_fee_multiple',
} as const;
export const paymentDayRule = { Calendar: 'calendar_days', Business: 'business_days' } as const;
export const billingFrequency = {
  Monthly: 'monthly',
  Single: 'single',
  Quarterly: 'quarterly',
  Custom: 'custom',
} as const;
export const paymentMethod = {
  Pix: 'pix',
  Boleto: 'boleto',
  Transfer: 'transfer',
  Card: 'card',
  Other: 'other',
} as const;
export const billingDueRule = {
  FixedDay: 'fixed_day',
  FirstBusinessDay: 'first_business_day',
  LastBusinessDay: 'last_business_day',
  Custom: 'custom',
} as const;

const amount = z
  .number()
  .finite()
  .nonnegative('Informe um valor maior ou igual a zero.')
  .max(Number.MAX_SAFE_INTEGER, 'O valor excede a precisão suportada.')
  .nullable();
const days = z
  .number()
  .int()
  .nonnegative('Informe um valor maior ou igual a zero.')
  .max(Number.MAX_SAFE_INTEGER, 'O valor excede a precisão suportada.')
  .nullable();
const date = z.iso.date('Informe uma data válida.').nullable();
const documentUrl = z.string().refine((value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}, 'Informe uma URL http(s) sem usuário ou senha.');

// Projeção exclusivamente demonstrativa; não descreve colunas/RPCs hospedados.
export const administrationValuesSchema = z
  .strictObject({
    startDate: date,
    endDate: date,
    contractType: z.enum(contractType).nullable(),
    contractModel: z.enum(contractModel).nullable(),
    autoRenew: z.boolean(),
    penaltyEnabled: z.boolean(),
    penaltyBase: z.enum(penaltyBase),
    penaltyValue: amount,
    terminationPaymentDays: days,
    terminationPaymentRule: z.enum(paymentDayRule),
    penaltyText: z.string(),
    contractValue: amount
      .refine(
        (value) => value === null || /^\d+(?:\.\d{1,2})?$/.test(String(value)),
        'Use até duas casas decimais.',
      )
      .transform((value) => (value === 0 ? null : value)),
    billingFrequency: z.enum(billingFrequency).nullable(),
    paymentMethod: z.enum(paymentMethod).nullable(),
    billingDueRule: z.enum(billingDueRule).nullable(),
    billingDay: z
      .number()
      .int('Informe um dia inteiro.')
      .min(1, 'Use um dia entre 1 e 31.')
      .max(31, 'Use um dia entre 1 e 31.')
      .nullable(),
    billingLeadDays: days,
    paymentTermDays: days,
    lateFeePercent: amount,
    dailyInterestPercent: amount,
    financialNote: z.string(),
    driveUrl: documentUrl,
    documentOwner: z.string(),
    documentNotes: z.string(),
  })
  .superRefine((value, context) => {
    if (value.startDate && value.endDate && value.endDate < value.startDate)
      context.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'O término não pode anteceder o início.',
      });
  });

export const administrationSchema = z.strictObject({
  companyId: z.uuid(),
  revision: z.number().int().nonnegative(),
  values: administrationValuesSchema,
});
export const updateAdministrationSchema = z.strictObject({
  requestId: z.uuid(),
  companyId: z.uuid(),
  expectedRevision: z.number().int().nonnegative(),
  values: administrationValuesSchema,
});
export const administrationEventSchema = z
  .strictObject({
    id: z.uuid(),
    companyId: z.uuid(),
    previous: administrationSchema,
    current: administrationSchema,
    recordedBy: z.uuid(),
    recordedAt: z.iso.datetime({ offset: true }),
  })
  .refine(
    (event) =>
      event.previous.companyId === event.companyId &&
      event.current.companyId === event.companyId &&
      event.current.revision === event.previous.revision + 1,
    'Histórico de ficha inconsistente.',
  );
export type AdministrationValues = z.infer<typeof administrationValuesSchema>;
export type CompanyAdministration = z.infer<typeof administrationSchema>;
export type UpdateAdministration = z.infer<typeof updateAdministrationSchema>;
export type AdministrationEvent = z.infer<typeof administrationEventSchema>;

export function emptyAdministration(companyId: string): CompanyAdministration {
  return {
    companyId,
    revision: 0,
    values: {
      startDate: null,
      endDate: null,
      contractType: null,
      contractModel: null,
      autoRenew: false,
      penaltyEnabled: false,
      penaltyBase: penaltyBase.TextOnly,
      penaltyValue: null,
      terminationPaymentDays: null,
      terminationPaymentRule: paymentDayRule.Calendar,
      penaltyText: '',
      contractValue: null,
      billingFrequency: null,
      paymentMethod: null,
      billingDueRule: null,
      billingDay: null,
      billingLeadDays: null,
      paymentTermDays: null,
      lateFeePercent: null,
      dailyInterestPercent: null,
      financialNote: '',
      driveUrl: '',
      documentOwner: '',
      documentNotes: '',
    },
  };
}
