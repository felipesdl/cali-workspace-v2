import { z } from 'zod';
import { type WorkspaceClient } from '../../supabase';

const slot = z.object({ startsAt: z.string(), endsAt: z.string() });
const appointments = z.array(
  z.object({
    id: z.uuid(),
    title: z.string(),
    status: z.string(),
    request_mode: z.enum(['remote', 'in_person']),
    created_at: z.string(),
    admin_note: z.string().nullable(),
    requested_slots: z.array(slot),
    admin_proposed_slots: z.array(slot),
    sync_status: z.string().nullable(),
  }),
);
const request = z.object({
  mode: z.enum(['remote', 'in_person']),
  title: z.string().trim().min(2).max(160),
  purpose: z.string().trim().max(2000),
  location: z.string().trim().max(400),
  slots: z
    .array(
      z.object({ start: z.iso.datetime({ local: true }), end: z.iso.datetime({ local: true }) }),
    )
    .min(1)
    .max(2),
});
export type AppointmentRequest = z.infer<typeof request>;

export function createAgendaOperations(client: WorkspaceClient) {
  return {
    async list(company: string, page: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_list_pilot_appointments', {
          p_company_id: company,
          p_page: page,
        })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar os pedidos de agenda.');
      return appointments.parse(data);
    },
    async request(company: string, id: string, input: AppointmentRequest) {
      const fields = request.parse(input);
      const { data, error } = await client.rpc('v2_request_pilot_appointment', {
        p_company_id: company,
        p_request_id: id,
        p_mode: fields.mode,
        p_title: fields.title,
        p_purpose: fields.purpose,
        p_location: fields.location,
        p_slots: fields.slots,
      });
      if (error?.code === '22023')
        throw new Error('Confira as opções e a cobertura do encontro no contrato.');
      if (error) throw new Error('Não foi possível registrar a solicitação.');
      return z.uuid().parse(data);
    },
    async respond(
      company: string,
      id: string,
      action: 'offer' | 'decline' | 'confirm',
      index: number | null,
      note: string,
    ) {
      const { data, error } = await client.rpc('v2_respond_pilot_appointment', {
        p_company_id: company,
        p_appointment_id: id,
        p_action: action,
        p_note: z.string().trim().max(2000).parse(note),
        p_index: index,
      });
      if (error?.code === '40001')
        throw new Error('A situação ou a disponibilidade mudou. Confira a agenda.');
      if (error) throw new Error('Não foi possível registrar a decisão de agenda.');
      return z.uuid().parse(data);
    },
  };
}
export type AgendaOperations = ReturnType<typeof createAgendaOperations>;
