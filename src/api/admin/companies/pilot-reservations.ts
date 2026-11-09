import { z } from 'zod';
import { type WorkspaceClient } from '../../supabase';

export const pilotInviteFields = z.object({
  name: z.string().trim().min(1, 'Informe o nome.').max(200),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email('Informe um e-mail válido.')),
});
const pendingInvite = pilotInviteFields.extend({ id: z.uuid() });

export function createPilotReservations(client: WorkspaceClient) {
  return {
    async cancel(companyId: string, inviteId: string) {
      const { error } = await client.rpc('v2_cancel_pilot_invite', {
        p_company_id: z.uuid().parse(companyId),
        p_invite_id: z.uuid().parse(inviteId),
      });
      if (error)
        throw new Error('Não foi possível cancelar a reserva. Confira o estado do acesso.');
    },
    async list(companyId: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc(
          'v2_list_pending_pilot_invites',
          { p_company_id: z.uuid().parse(companyId) },
          { get: true },
        )
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar as reservas.');
      return z.array(pendingInvite).max(4).parse(data);
    },
    async reserve(companyId: string, requestId: string, draft: z.input<typeof pilotInviteFields>) {
      const values = pilotInviteFields.parse(draft);
      const { data, error } = await client.rpc('v2_reserve_pilot_invite', {
        p_company_id: z.uuid().parse(companyId),
        p_request_id: z.uuid().parse(requestId),
        p_name: values.name,
        p_email: values.email,
      });
      if (error?.code === '23514') throw new Error('As quatro vagas estão ocupadas.');
      if (error)
        throw new Error('Reserva indisponível. Confira a adesão e o destinatário de teste.');
      return z.uuid().parse(data);
    },
  };
}
