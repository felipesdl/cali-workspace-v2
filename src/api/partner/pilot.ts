import { z } from 'zod';
import type { WorkspaceClient } from '../supabase';
import { readPublishedTerms } from '../access/hosted-terms';
import { acceptCurrentTermsSchema, type CurrentTerms } from '../access/session';
import { decodePdf, pdfPayload } from '../shared/workspace/pdf-payload';

const baseModules = z.enum(['projects', 'records', 'hours']);
export const partnerModule = z.enum([
  ...baseModules.options,
  'calendar',
  'documents',
  'reports',
  'notices',
  'team',
]);
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
export type PartnerDetailModule = 'projects' | 'records';
export function hasPartnerItemDetail(module: PartnerModule): module is PartnerDetailModule {
  return module === 'projects' || module === 'records';
}
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
      instant: z.iso.datetime({ offset: true }).nullish(),
      summary: z.string().nullish(),
      downloadRevision: z.uuid().nullish(),
      downloadVersion: z.number().int().positive().nullish(),
    }),
  ),
});

const detail = z.object({
  canReply: z.boolean().optional(),
  title: z.string(),
  total: z.number().int().nonnegative(),
  rows: z.array(
    z.object({
      id: z.uuid(),
      title: z.string().nullable(),
      protocol: z.string().nullable(),
      status: z.string().nullable(),
      instant: z.string().nullable(),
      canReview: z.boolean().optional(),
    }),
  ),
});

export const partnerTimerTargetKind = z.enum(['project', 'delivery', 'task', 'record']);
const timer = z.object({
  active: z.object({ id: z.uuid(), description: z.string(), startedAt: z.string() }).nullable(),
  targets: z.array(z.object({ kind: partnerTimerTargetKind, id: z.uuid(), title: z.string() })),
});
const timerResult = z.object({
  id: z.uuid(),
  status: z.enum(['active', 'stopped', 'discarded']),
  minutes: z.number().int().nullable(),
});
type TimerTarget = z.infer<typeof timer>['targets'][number];
export type PartnerTimerCommand =
  { action: 'start'; description: string; target?: TimerTarget } | { action: 'stop'; id: string };

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

const reviewKind = z.enum(['deliverable', 'record_close']);
export type PartnerReviewKind = z.infer<typeof reviewKind>;
const reviewQueue = z.object({
  total: z.number().int().nonnegative(),
  rows: z.array(
    z.object({
      id: z.uuid(),
      kind: reviewKind,
      title: z.string(),
      note: z.string().nullable(),
      status: z.enum(['pending', 'approved', 'returned']),
      decision_note: z.string().nullable(),
    }),
  ),
});

const qaSession = z.object({ access_token: z.string().min(1), refresh_token: z.string().min(1) });

export function createPartnerOtpQa(client: WorkspaceClient, ticket: string) {
  if (!/^[a-f0-9]{64}$/.test(ticket)) return undefined;
  async function call(body: { email: string; action: 'request' | 'verify'; code?: string }) {
    const response = await fetch(
      'https://kqtbfeeqbcllwvlkbrkq.supabase.co/functions/v1/workspace-partner-otp-qa',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cali-qa-ticket': ticket },
        cache: 'no-store',
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      },
    );
    // Uma janela permite um envio. Reabrir o formulário não solicita outro código.
    if (body.action === 'request' && response.status === 429) return { accepted: true };
    if (!response.ok) {
      throw new Error(
        response.status === 403
          ? 'Código inválido, expirado ou já utilizado.'
          : 'O serviço de homologação não concluiu a solicitação.',
      );
    }
    return response.json();
  }
  return {
    async requestCode(email: string) {
      z.object({ accepted: z.literal(true) }).parse(await call({ email, action: 'request' }));
    },
    async verifyCode(email: string, code: string) {
      const session = qaSession.parse(await call({ email, code, action: 'verify' }));
      const saved = await client.auth.setSession(session);
      if (saved.error || !saved.data.session)
        throw new Error('A sessão de homologação não foi salva.');
      // Reinicia o piloto após salvar a sessão; o controlador Admin/Cliente pode limpar a consulta atual.
      // eslint-disable-next-line no-restricted-syntax -- Exclusivo da janela OTP descartável em Vite dev.
      window.location.reload();
    },
  };
}

export function createPartnerPilot(
  client: WorkspaceClient,
  otp?: ReturnType<typeof createPartnerOtpQa>,
) {
  return {
    requestCode: otp?.requestCode,
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
    async verifyCode(email: string, code: string) {
      if (otp) return otp.verifyCode(email, code);
      const address = z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^cali-qa-staff-[0-9a-f-]{36}@example\.invalid$/)
        .parse(email);
      const token = z
        .string()
        .regex(/^\d{8}$/)
        .parse(code);
      const { error } = await client.auth.verifyOtp({ email: address, token, type: 'email' });
      if (error) throw new Error('Código indisponível. Confira os dados.');
    },
    async acceptInvite() {
      const { error } = await client.rpc('v2_accept_partner_pilot_invite');
      if (error) throw new Error('Convite indisponível.');
    },
    async acceptTerms(terms: CurrentTerms) {
      const selected = acceptCurrentTermsSchema.parse({
        version: terms.version,
        contentHash: terms.contentHash,
      });
      const { error } = await client.rpc('v2_accept_partner_pilot_terms', {
        p_version: selected.version,
        p_content_hash: selected.contentHash,
      });
      if (error) throw new Error('Não foi possível confirmar o aceite dos termos.');
    },
    async timer(company: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_partner_pilot_timer', { p_company: company })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar o cronômetro.');
      return timer.parse(data);
    },
    async changeTimer(company: string, request: string, command: PartnerTimerCommand) {
      const start = command.action === 'start';
      const { data, error } = await client.rpc('v2_change_partner_pilot_timer', {
        p_company: company,
        p_request: request,
        p_action: command.action,
        p_timer: start ? null : command.id,
        p_kind: start ? (command.target?.kind ?? null) : null,
        p_target: start ? (command.target?.id ?? null) : null,
        p_description: start ? command.description : null,
      });
      if (error?.code === '40001') throw new Error('Confira se já existe um cronômetro aberto.');
      if (error?.code === '42501') throw new Error('Cronômetro ou vínculo indisponível.');
      if (error) throw new Error('Não foi possível confirmar a operação do cronômetro.');
      return timerResult.parse(data);
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
    async reviews(company: string, admin: boolean, page: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_list_partner_pilot_reviews', {
          p_company: company,
          p_admin: admin,
          p_page: page,
        })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar as revisões.');
      return reviewQueue.parse(data);
    },
    async submitReview(
      company: string,
      request: string,
      kind: PartnerReviewKind,
      item: string,
      note: string,
    ) {
      const { data, error } = await client.rpc('v2_submit_partner_pilot_review', {
        p_company: company,
        p_request: request,
        p_kind: kind,
        p_item: item,
        p_note: note,
      });
      if (error?.code === '40001')
        throw new Error('Já existe uma revisão ou o item mudou. Atualize a tela.');
      if (error) throw new Error('Não foi possível enviar o item para revisão.');
      return z.uuid().parse(data);
    },
    async decideReview(company: string, request: string, approve: boolean, note: string) {
      const { data, error } = await client.rpc('v2_decide_partner_pilot_review', {
        p_company: company,
        p_request: request,
        p_approve: approve,
        p_note: note,
      });
      if (error?.code === '22023') throw new Error('Informe o motivo para devolver a revisão.');
      if (error?.code === '40001') throw new Error('A revisão ou o item mudou. Atualize a fila.');
      if (error) throw new Error('Não foi possível registrar a decisão.');
      return z.uuid().parse(data);
    },
    async documentPdf(company: string, id: string, revision: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_download_partner_pilot_document', {
          p_company: company,
          p_document: id,
          p_revision: revision,
        })
        .abortSignal(signal);
      if (error) throw new Error('Documento indisponível para esta revisão.');
      return decodePdf(
        pdfPayload.extend({ id: z.literal(id), revisionId: z.literal(revision) }).parse(data),
      );
    },
    async reportPdf(company: string, report: string, version: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_download_partner_pilot_report', {
          p_company: company,
          p_report: report,
          p_version: version,
        })
        .abortSignal(signal);
      if (error) throw new Error('PDF indisponível para esta revisão.');
      return decodePdf(
        pdfPayload.extend({ id: z.literal(report), version: z.literal(version) }).parse(data),
      );
    },
    async replyRecord(company: string, request: string, record: string, body: string) {
      const { data, error } = await client.rpc('v2_reply_partner_pilot_record', {
        p_company: company,
        p_request: request,
        p_record: record,
        p_body: z.string().trim().min(1).max(4000).parse(body),
      });
      if (error?.code === '42501') throw new Error('A conversa está indisponível.');
      if (error) throw new Error('Não foi possível confirmar o envio.');
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
        .rpc(
          baseModules.safeParse(module).success
            ? 'v2_list_partner_pilot_items'
            : 'v2_list_partner_pilot_catalog',
          {
            p_company: company,
            p_module: module,
            p_page: number,
          },
        )
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar este módulo.');
      return page.parse(data);
    },
  };
}
export type PartnerPilot = ReturnType<typeof createPartnerPilot>;
