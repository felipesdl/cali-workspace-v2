import { z } from 'zod';
import { type WorkspaceClient } from '../../supabase';
import { administrationValuesSchema, type AdministrationValues } from './administration-schemas';

const columns = {
  startDate: 'start_date',
  endDate: 'end_date',
  contractType: 'contract_type',
  contractModel: 'contract_model',
  autoRenew: 'auto_renew',
  penaltyEnabled: 'contract_penalty_enabled',
  penaltyBase: 'termination_penalty_type',
  penaltyValue: 'termination_penalty_value',
  terminationPaymentDays: 'termination_payment_days',
  terminationPaymentRule: 'termination_payment_rule',
  penaltyText: 'contract_penalty_text',
  contractValue: 'contract_value',
  billingFrequency: 'billing_frequency',
  paymentMethod: 'payment_method',
  billingDueRule: 'billing_due_rule',
  billingDay: 'billing_day',
  billingLeadDays: 'billing_lead_days',
  paymentTermDays: 'payment_term_days',
  lateFeePercent: 'late_fee_percent',
  dailyInterestPercent: 'daily_interest_percent',
  financialNote: 'payment_notes',
  driveUrl: 'drive_folder_url',
  documentOwner: 'document_owner',
  documentNotes: 'document_notes',
} as const satisfies Record<keyof AdministrationValues, string>;

const rowSchema = z
  .object({
    id: z.uuid(),
    updated_at: z.iso.datetime({ offset: true }),
  })
  .catchall(z.union([z.string(), z.number(), z.boolean(), z.null()]));

export type HostedAdministration = {
  companyId: string;
  updatedAt: string;
  values: AdministrationValues;
};

export function createHostedAdministration(client: WorkspaceClient) {
  return {
    async read(companyId: string, signal: AbortSignal): Promise<HostedAdministration> {
      const id = z.uuid().parse(companyId);
      const { data, error } = await client
        .from('companies')
        .select(['id', 'updated_at', ...Object.values(columns)].join(','))
        .eq('id', id)
        .abortSignal(signal)
        .single();
      if (error) throw new Error('Não foi possível carregar a ficha administrativa.');
      const row = rowSchema.parse(data);
      if (row.id !== id) throw new Error('Ficha de outra empresa recusada.');
      const values = Object.fromEntries(
        Object.entries(columns).map(([key, column]) => [key, row[column]]),
      );
      return {
        companyId: id,
        updatedAt: row.updated_at,
        values: administrationValuesSchema.parse({
          ...values,
          penaltyText: row.contract_penalty_text ?? '',
          financialNote: row.payment_notes ?? '',
          driveUrl: row.drive_folder_url ?? '',
          documentOwner: row.document_owner ?? '',
          documentNotes: row.document_notes ?? '',
        }),
      };
    },
    async update(record: HostedAdministration, draft: AdministrationValues) {
      const values = administrationValuesSchema.parse(draft);
      const payload = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [
          columns[key as keyof AdministrationValues],
          value,
        ]),
      );
      const { data, error } = await client.rpc('v2_update_pilot_company_contract', {
        p_company_id: z.uuid().parse(record.companyId),
        p_expected_at: z.iso.datetime({ offset: true }).parse(record.updatedAt),
        p_values: payload,
      });
      if (error?.code === '40001') throw new Error('A ficha mudou. Recarregue antes de salvar.');
      if (error || data !== record.companyId)
        throw new Error('Não foi possível confirmar a ficha administrativa.');
    },
  };
}
