import { z } from 'zod';
import type { WorkspaceClient } from '../../supabase';
import { readPublishedTerms } from '../access/hosted-terms';
import { acceptCurrentTermsSchema, type CurrentTerms } from '../access/session';

export const partnerModule = z.enum(['projects', 'records', 'hours']);
export type PartnerModule = z.infer<typeof partnerModule>;
const access = z.discriminatedUnion('status', [
  z.object({ status: z.enum(['blocked', 'mfa_required', 'invite_required', 'terms_unavailable']) }),
  acceptCurrentTermsSchema.extend({ status: z.literal('terms_required') }),
  z.object({
    status: z.literal('ready'),
    actor: z.uuid(),
    company: z.uuid(),
    companyName: z.string(),
    modules: z.array(partnerModule),
  }),
]);
export type PartnerDetailModule = Exclude<PartnerModule, 'hours'>;
const page = z.object({
  total: z.number().int().nonnegative(),
  rows: z.array(
    z.object({
      id: z.uuid(),
      title: z.string().nullable(),
      protocol: z.string().nullable(),
      status: z.string().nullable(),
      day: z.iso.date().nullable(),
      minutes: z.number().int().nullable(),
    }),
  ),
});

const detail = z.object({
  title: z.string(),
  total: z.number().int().nonnegative(),
  rows: z.array(
    z.object({
      id: z.uuid(),
      title: z.string().nullable(),
      protocol: z.string().nullable(),
      status: z.string().nullable(),
      instant: z.string().nullable(),
    }),
  ),
});

const hourQueue = z.object({
  total: z.number().int().nonnegative(),
  rows: z.array(
    z.object({
      id: z.uuid(),
      day: z.iso.date(),
      minutes: z.number().int(),
      description: z.string(),
      justification: z.string(),
      status: z.enum(['pending', 'approved', 'rejected']),
      decision_note: z.string().nullable(),
      member_name: z.string().nullable(),
    }),
  ),
});

export function createPartnerPilot(client: WorkspaceClient) {
  return {
    subscribe(listener: () => void) {
      const { data } = client.auth.onAuthStateChange(() => setTimeout(listener, 0));
      return () => data.subscription.unsubscribe();
    },
    async read(signal: AbortSignal) {
      const session = await client.auth.getSession();
      signal.throwIfAborted();
      if (session.error) throw new Error('Não foi possível confirmar a sessão.');
      if (!session.data.session) return { status: 'signed_out' } as const;
      const { data, error } = await client.rpc('v2_read_partner_pilot').abortSignal(signal);
      if (error) throw new Error('Não foi possível confirmar o acesso Partner.');
      const result = access.parse(data);
      if (result.status === 'terms_required') {
        const terms = await readPublishedTerms(result);
        return terms
          ? ({ status: 'terms_required', terms } as const)
          : ({ status: 'terms_unavailable' } as const);
      }
      return result;
    },
    async acceptInvite() {
      const { error } = await client.rpc('v2_accept_partner_pilot_invite');
      if (error) throw new Error('Convite indisponível.');
    },
    async acceptTerms(terms: CurrentTerms) {
      const selected = acceptCurrentTermsSchema.parse(terms);
      const { error } = await client.rpc('v2_accept_partner_pilot_terms', {
        p_version: selected.version,
        p_content_hash: selected.contentHash,
      });
      if (error) throw new Error('Não foi possível confirmar o aceite dos termos.');
    },
    async hourRequests(company: string, admin: boolean, number: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_list_partner_pilot_hour_requests', {
          p_company: company,
          p_admin: admin,
          p_page: number,
        })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar as solicitações.');
      return hourQueue.parse(data);
    },
    async submitHours(
      company: string,
      request: string,
      input: { day: string; minutes: number; description: string; justification: string },
    ) {
      const { data, error } = await client.rpc('v2_submit_partner_pilot_hours', {
        p_company: company,
        p_request: request,
        p_day: input.day,
        p_minutes: input.minutes,
        p_description: input.description,
        p_justification: input.justification,
      });
      if (error?.code === '22023')
        throw new Error('Confira data, duração, descrição e justificativa.');
      if (error) throw new Error('Não foi possível enviar a solicitação.');
      return z.uuid().parse(data);
    },
    async decideHours(company: string, request: string, approve: boolean, note: string) {
      const { data, error } = await client.rpc('v2_decide_partner_pilot_hours', {
        p_company: company,
        p_request: request,
        p_approve: approve,
        p_note: note,
      });
      if (error?.code === '22023') throw new Error('Confira a decisão e o motivo da recusa.');
      if (error?.code === '40001')
        throw new Error('A solicitação já foi decidida. Atualize a fila.');
      if (error) throw new Error('Não foi possível registrar a decisão.');
      return z.uuid().parse(data);
    },
    async detail(
      company: string,
      module: PartnerDetailModule,
      id: string,
      page: number,
      signal: AbortSignal,
    ) {
      const { data, error } = await client
        .rpc('v2_read_partner_pilot_detail', {
          p_company: company,
          p_module: module,
          p_item: id,
          p_page: page,
        })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar o detalhe.');
      return detail.nullable().parse(data);
    },
    async items(company: string, module: PartnerModule, number: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_list_partner_pilot_items', {
          p_company: company,
          p_module: module,
          p_page: number,
        })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar este módulo.');
      return page.parse(data);
    },
  };
}
export type PartnerPilot = ReturnType<typeof createPartnerPilot>;
