import { z } from 'zod';
import { type WorkspaceClient } from '../../supabase';

const hours = z.number().nonnegative().nullable();
export const monthlyFields = z.strictObject({
  planned_hours: hours,
  absence_medical_hours: hours,
  absence_leave_hours: hours,
  absence_unjustified_hours: hours,
  absence_accident_hours: hours,
  overtime_hours: hours,
  hour_bank_balance: z.number().nullable(),
  approved_headcount: z.record(z.string().trim().min(1).max(180), z.number().int().nonnegative()),
  enps_score: z.number().int().min(-100).max(100).nullable(),
  climate_score: z.number().min(0).max(10).nullable(),
  climate_participation: z.number().min(0).max(100).nullable(),
  notes: z.string().max(5000).nullable(),
});
export type MonthlyFields = z.infer<typeof monthlyFields>;
export const monthlyRecord = monthlyFields.extend({
  company_id: z.uuid(),
  reference_month: z.iso.date(),
  updated_by: z.uuid().nullable(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});
export type MonthlyRecord = z.infer<typeof monthlyRecord>;
export const monthlyState = z.object({
  companyId: z.uuid(),
  referenceMonth: z.iso.date(),
  metrics: monthlyRecord.nullable(),
  review: z
    .object({
      revision: z.number().int().positive(),
      confirmedAt: z.iso.datetime({ offset: true }),
      answers: z.record(z.string(), z.number().int().nonnegative()),
    })
    .nullable(),
  events: z.array(
    z.object({
      id: z.uuid(),
      domain: z.enum(['metrics', 'review']),
      revision: z.number().int().positive(),
      actor_id: z.uuid(),
      recorded_at: z.iso.datetime({ offset: true }),
      reason: z.string().nullable(),
    }),
  ),
});
export type MonthlyState = z.infer<typeof monthlyState>;
export const monthlyWriteResult = z.object({
  updatedAt: z.iso.datetime({ offset: true }),
  revision: z.number().int().positive(),
});
export type MonthlyCommand = {
  companyId: string;
  month: string;
  expectedAt: string | null;
  fields: MonthlyFields;
  reason: string;
  requestId: string;
};

export function createHostedTeamMonthly(client: WorkspaceClient) {
  return {
    async read(companyId: string, month: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pilot_team_month', {
          p_company_id: companyId,
          p_month: month,
        })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível carregar os dados do mês.');
      const result = monthlyState.parse(data);
      if (result.companyId !== companyId || result.referenceMonth !== month)
        throw new Error('Dados fora da referência solicitada.');
      return result;
    },
    async write(command: MonthlyCommand) {
      const { data, error } = await client.rpc('v2_write_pilot_team_metrics', {
        p_company_id: command.companyId,
        p_month: command.month,
        p_expected_at: command.expectedAt,
        p_fields: monthlyFields.parse(command.fields),
        p_reason: command.reason.trim() || null,
        p_request_id: command.requestId,
      });
      if (error?.code === '40001')
        throw new Error('Os dados mudaram. Recarregue e revise antes de salvar.');
      if (error?.code === '22023' || error?.code === '42501') throw new Error(error.message);
      if (error) throw new Error('Não foi possível confirmar os dados mensais.');
      return monthlyWriteResult.parse(data);
    },
  };
}
export type TeamMonthlyService = ReturnType<typeof createHostedTeamMonthly>;
