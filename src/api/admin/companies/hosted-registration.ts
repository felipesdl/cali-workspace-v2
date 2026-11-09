import { z } from 'zod';
import { type WorkspaceClient } from '../../supabase';

const textField = z.string().trim().max(250);
export const hostedRegistrationDraft = z.object({
  segment: textField,
  monthly_hours_contracted: z
    .string()
    .trim()
    .regex(/^$|^\d{1,6}([,.]\d{1,2})?$/, 'Use até seis dígitos e duas casas decimais.'),
  address_street: textField,
  address_number: textField,
  address_neighborhood: textField,
  address_city: textField,
  address_state: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^$|^[A-Z]{2}$/, 'Use duas letras.'),
  has_branches: z.enum(['yes', 'no']),
  branches: z.string().max(5000),
});
export type HostedRegistrationDraft = z.input<typeof hostedRegistrationDraft>;

const registrationRow = z.object({
  id: z.uuid(),
  updated_at: z.iso.datetime({ offset: true }),
  service_type: z.string().nullable(),
  service_plan: z.string().nullable(),
  segment: z.string().nullable(),
  monthly_hours_contracted: z.number().nonnegative().nullable(),
  address_street: z.string().nullable(),
  address_number: z.string().nullable(),
  address_neighborhood: z.string().nullable(),
  address_city: z.string().nullable(),
  address_state: z.string().nullable(),
  has_branches: z.boolean().nullable(),
  branches: z.array(z.string()).nullable(),
});
export type HostedRegistration = z.infer<typeof registrationRow>;
const fields =
  'id,updated_at,service_type,service_plan,segment,monthly_hours_contracted,address_street,address_number,address_neighborhood,address_city,address_state,has_branches,branches';

export function createHostedRegistration(client: WorkspaceClient) {
  return {
    async read(companyId: string, signal: AbortSignal) {
      const id = z.uuid().parse(companyId);
      const { data, error } = await client
        .from('companies')
        .select(fields)
        .eq('id', id)
        .abortSignal(signal)
        .single();
      if (error) throw new Error('Não foi possível consultar o cadastro complementar.');
      const record = registrationRow.parse(data);
      if (record.id !== id) throw new Error('Cadastro de outra empresa recusado.');
      return record;
    },
    async update(record: HostedRegistration, draft: HostedRegistrationDraft) {
      const value = hostedRegistrationDraft.parse(draft);
      const { data, error } = await client.rpc('v2_update_pilot_company_registration', {
        p_company_id: z.uuid().parse(record.id),
        p_expected_at: z.iso.datetime({ offset: true }).parse(record.updated_at),
        p_values: {
          ...value,
          has_branches: value.has_branches === 'yes',
          monthly_hours_contracted:
            Number(value.monthly_hours_contracted.replace(',', '.')) || null,
          branches: value.branches
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
        },
      });
      if (error?.code === '40001')
        throw new Error('O cadastro mudou. Recarregue a ficha antes de salvar.');
      if (error || data !== record.id)
        throw new Error('Não foi possível confirmar a edição do cadastro.');
    },
  };
}
