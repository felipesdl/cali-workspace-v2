import { z } from 'zod';
import { type WorkspaceClient } from '../../supabase';

const auditEvents = [
  'report_draft_created',
  'report_review',
  'report_approve',
  'report_pdf_generated',
  'report_released_in_app',
  'report_reopen',
  'report_release_acknowledged',
  'document_revision_added',
  'document_published',
  'document_withdrawn',
  'deliverable_reopened',
  'deliverable_client_approved',
  'record_open',
  'account_record_feedback',
  'record_reopen_requested',
  'record_reopen_decided',
  'agenda_change_requested',
  'agenda_change_decided',
  'scheduling_event_not_occurred',
  'notice_comment_hidden',
  'notice_comment_restored',
  'capacity_pause_recorded',
  'capacity_pause_resumed',
  'satisfaction_followup_saved',
  'commercial_proposal_edited',
  'commercial_proposal_created',
  'commercial_proposal_delivered',
  'commercial_proposal_accepted',
  'commercial_proposal_approved',
  'form_draft_created',
  'form_draft_edited',
  'form_open',
  'form_closed',
  'form_response_triaged',
  'form_responses_exported',
] as const;
export type AuditEvent = (typeof auditEvents)[number];

const page = z.object({ companyId: z.uuid(), total: z.number().int().nonnegative() });
const mapaRoster = page.extend({
  entries: z.array(
    z.object({
      id: z.uuid(),
      protocol: z.string(),
      status: z.string(),
      createdAt: z.iso.datetime({ offset: true }),
      opinion: z.string().nullable(),
      revision: z.number().int().nonnegative(),
    }),
  ),
});
export type MapaEntry = z.infer<typeof mapaRoster>['entries'][number];
const mapaJourneys = page.extend({
  entries: z.array(
    z.object({
      id: z.string().regex(/^[a-f0-9]{64}$/),
      accessedAt: z.iso.datetime({ offset: true }),
      lastSeenAt: z.iso.datetime({ offset: true }),
      step: z.number().int().min(0).max(7),
      started: z.boolean(),
      copies: z.number().int().nonnegative(),
      device: z.string().nullable(),
      referrer: z.string().nullable(),
      status: z.enum(['completed', 'in_progress', 'abandoned']),
    }),
  ),
});
const mapaScore = z.number().min(0).max(10);
export const mapaReport = z.object({
  companyId: z.uuid(),
  recordId: z.uuid(),
  version: z.union([z.literal(1), z.literal(2)]),
  dimensions: z.tuple([mapaScore, mapaScore, mapaScore, mapaScore]),
  subscores: z.array(mapaScore).length(12).nullable(),
  score: mapaScore,
  protocol: z.string().optional(),
  createdAt: z.iso.datetime({ offset: true }).optional(),
  companyName: z.string().nullish(),
  observations: z
    .tuple([
      z.string().nullable(),
      z.string().nullable(),
      z.string().nullable(),
      z.string().nullable(),
    ])
    .optional(),
  opinion: z.string().nullish(),
  recommendedService: z.string().optional(),
});
export type MapaReport = z.infer<typeof mapaReport>;

const staffRoster = page.extend({
  entries: z.array(
    z.object({
      id: z.uuid(),
      name: z.string().nullable(),
      active: z.boolean(),
      modules: z.array(z.string()).nullable(),
      invitation: z.enum(['not_invited', 'invited', 'accepted']),
      assignedAt: z.iso.datetime({ offset: true }).nullable(),
      activationRevision: z.iso.datetime({ offset: true }).nullish(),
      draftRevision: z.iso.datetime({ offset: true }).nullish(),
    }),
  ),
});
const counter = z.number().int().nonnegative();
const summaryBlock = z.object({
  total: counter,
  items: z
    .array(
      z.object({
        id: z.uuid(),
        at: z.iso.datetime({ offset: true }),
        title: z.string(),
        excerpt: z.string().nullable(),
        link: z
          .string()
          .regex(/^\/(admin|cliente)\/[A-Za-z0-9/_?&=.%:-]+$/)
          .nullable(),
      }),
    )
    .max(12),
});
const dailyPreview = z.object({
  day: z.iso.date(),
  asOf: z.iso.datetime({ offset: true }),
  clientTotal: counter,
  caliTotal: counter,
  minutes: counter,
  companies: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      minutes: counter,
      client: summaryBlock,
      cali: summaryBlock,
    }),
  ),
});
export type DailyPreview = z.infer<typeof dailyPreview>;
const audit = page.extend({
  month: z.iso.date().nullable(),
  entries: z.array(
    z.object({
      id: z.string(),
      at: z.iso.datetime({ offset: true }),
      event: z.enum(auditEvents),
      entity: z.string(),
      objectId: z.uuid().nullable(),
      actorName: z.string(),
      revision: z.number().nullable(),
      protocol: z.string().nullable(),
    }),
  ),
});
const opportunityStatus = z.enum([
  'novo',
  'analise',
  'edicao',
  'aprovada',
  'enviada',
  'negociacao',
  'fechada',
  'recusada',
  'expirada',
]);
const proposalStatus = z.enum([
  'rascunho',
  'aprovada',
  'enviada',
  'aceita',
  'recusada',
  'expirada',
]);
export type OpportunityStatus = z.infer<typeof opportunityStatus>;
export type ProposalStatus = z.infer<typeof proposalStatus>;
const commercial = page.extend({
  entries: z.array(
    z.object({
      opportunityId: z.uuid(),
      canCreate: z.boolean().default(false),
      canSend: z.boolean().default(false),
      canEmail: z.boolean().default(false),
      protocol: z.string().nullable(),
      opportunityStatus,
      service: z.string(),
      proposalId: z.uuid().nullable(),
      proposalStatus: proposalStatus.nullable(),
      version: z.number().int().positive().nullable(),
      total: z.number().nullable(),
      package: z.string().nullable(),
      updatedAt: z.iso.datetime({ offset: true }).nullable(),
    }),
  ),
});
const receivedOffers = z.array(
  z.object({
    id: z.uuid(),
    protocol: z.string(),
    version: z.number().int().positive(),
    total: z.number(),
    package: z.string(),
    paymentTerms: z.string().nullable(),
    publicNotes: z.string().nullable(),
    acceptBy: z.iso.datetime({ offset: true }),
    acceptedAt: z.iso.datetime({ offset: true }).nullable(),
    canAccept: z.boolean(),
  }),
);
const externalOffer = z.object({
  protocol: z.string(),
  version: z.number().int().positive(),
  total: z.number().positive(),
  package: z.enum(['ESSENCIAL', 'COMPLETO']),
  months: z.number().int().positive(),
  paymentTerms: z.string().nullable(),
  publicNotes: z.string().nullable(),
  deadline: z.iso.datetime({ offset: true }),
  acceptedAt: z.iso.datetime({ offset: true }).nullable(),
});

const satisfactionSource = z.enum(['record', 'deliverable']);
const theme = z.enum(['prazo', 'qualidade', 'comunicacao', 'atendimento', 'outro']);
export type FollowupTheme = z.infer<typeof theme>;
const satisfactionEntry = z.object({
  source: satisfactionSource,
  response: z.string().min(1).max(64),
  title: z.string(),
  score: z.number().int().min(1).max(3),
  comment: z.string().nullable(),
  ratedAt: z.iso.datetime({ offset: true }),
  followup: z
    .object({
      theme: theme.nullable(),
      note: z.string().nullable(),
      handledAt: z.iso.datetime({ offset: true }),
    })
    .nullable(),
});
export type SatisfactionEntry = z.infer<typeof satisfactionEntry>;
const satisfaction = page.extend({ entries: z.array(satisfactionEntry) });

export const commercialScopeMode = z.enum(['integral', 'prioritized']);
type CommercialPricingOptions = {
  scopeMode: z.infer<typeof commercialScopeMode>;
  manualFinalAmount: number | null;
};
const commercialDraft = z.object({
  id: z.uuid(),
  updatedAt: z.iso.datetime({ offset: true }),
  paymentTerms: z.string().nullable(),
  publicNotes: z.string().nullable(),
  validityDays: z.number().int().min(1).max(120),
  pricing: z
    .object({
      extras: z.number().nonnegative(),
      discount: z.number().min(0).max(50),
      months: z.number().int().min(1).max(60),
      subtotal: z.number().nonnegative(),
      monthly: z.number().nonnegative(),
      recurring: z.boolean().optional(),
      scopeMode: commercialScopeMode.optional(),
      manualFinalAmount: z.number().positive().nullish(),
    })
    .nullish(),
});
type CommercialDraftChange = { paymentTerms: string; publicNotes: string; validityDays: number };
export function createAdminRead(client: WorkspaceClient) {
  return {
    async mapa(company: string, page: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_list_pilot_mapa', { p_company_id: company, p_page: page })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar o Mapa de People.');
      const result = mapaRoster.parse(data);
      if (result.companyId !== company) throw new Error('Contexto divergente.');
      return result;
    },
    async mapaJourneys(company: string, page: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_list_pilot_mapa_journeys', { p_company_id: company, p_page: page })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar a jornada.');
      const result = mapaJourneys.parse(data);
      if (result.companyId !== company) throw new Error('Contexto divergente.');
      return result;
    },
    async mapaReport(company: string, record: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pilot_mapa_report', { p_company_id: company, p_record_id: record })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar o diagnóstico.');
      const report = mapaReport.nullable().parse(data);
      if (report && (report.companyId !== company || report.recordId !== record)) {
        throw new Error('Contexto divergente.');
      }
      return report;
    },
    async emailMapaReport(report: MapaReport) {
      const { data, error } = await client.functions.invoke('workspace-mapa-email-pilot', {
        body: { report },
      });
      if (error) throw new Error('Não foi possível confirmar o envio de teste.');
      return z.object({ accepted: z.literal(true) }).parse(data);
    },
    async staffRoster(company: string, page: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pilot_staff_roster', { p_company_id: company, p_page: page })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar a equipe CALI.');
      const result = staffRoster.parse(data);
      if (result.companyId !== company) throw new Error('Contexto divergente.');
      return result;
    },
    async dailyPreview(signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pilot_admin_daily_preview')
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar o resumo.');
      return dailyPreview.parse(data);
    },
    async satisfaction(company: string, page: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pilot_satisfaction', {
          p_company_id: company,
          p_page: page,
        })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar as avaliações.');
      const result = satisfaction.parse(data);
      if (result.companyId !== company) throw new Error('Contexto divergente.');
      return result;
    },
    async saveFollowup(company: string, entry: SatisfactionEntry, nextTheme: string, note: string) {
      const { data, error } = await client.rpc('v2_save_pilot_satisfaction_followup', {
        p_company_id: company,
        p_source: entry.source,
        p_response: entry.response,
        p_rated_at: entry.ratedAt,
        p_expected_followup: entry.followup?.handledAt ?? null,
        p_theme: nextTheme ? theme.parse(nextTheme) : null,
        p_note: z.string().trim().max(2000).parse(note),
      });
      if (error?.code === '40001')
        throw new Error('A avaliação ou o acompanhamento mudou. Atualize a consulta.');
      if (error) throw new Error('Não foi possível registrar o acompanhamento.');
      return z.uuid().parse(data);
    },
    async audit(company: string, month: string | null, page: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pilot_audit', {
          p_company_id: company,
          p_month: month,
          p_page: page,
        })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar a auditoria.');
      const result = audit.parse(data);
      if (result.companyId !== company || result.month !== month)
        throw new Error('Contexto divergente.');
      return result;
    },
    async commercialDraft(company: string, proposal: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pilot_commercial_draft', {
          p_company_id: company,
          p_proposal_id: proposal,
        })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar o rascunho.');
      const draft = commercialDraft.nullable().parse(data);
      if (draft && draft.id !== proposal) throw new Error('Proposta divergente.');
      return draft;
    },
    async createCommercialDraft(company: string, opportunity: string) {
      const { data, error } = await client.rpc('v2_create_pilot_commercial_draft', {
        p_company_id: company,
        p_submission_id: opportunity,
      });
      if (error?.code === '40001') throw new Error('A oportunidade mudou. Atualize a consulta.');
      if (error) throw new Error('Não foi possível criar o rascunho.');
      return z.uuid().parse(data);
    },
    async priceCommercialDraft(
      company: string,
      proposal: string,
      expected: string,
      pricing: {
        extras: number;
        discount: number;
        months: number;
        options?: CommercialPricingOptions;
      },
    ) {
      const { data, error } = await client.rpc('v2_price_pilot_commercial_draft', {
        p_company_id: company,
        p_proposal_id: proposal,
        p_expected: expected,
        p_extras: pricing.extras,
        p_discount: pricing.discount,
        p_months: pricing.months,
        ...(pricing.options && {
          p_scope_mode: pricing.options.scopeMode,
          p_manual_final: pricing.options.manualFinalAmount,
        }),
      });
      if (error?.code === '40001') throw new Error('A proposta mudou. Atualize a consulta.');
      if (error?.code === '22023')
        throw new Error('Confira escopo, adicionais, prazo e o limite de 50% de desconto.');
      if (error) throw new Error('Não foi possível calcular o valor.');
      return z.literal(proposal).parse(data);
    },
    async sendCommercialOffer(company: string, proposal: string, expected: string) {
      const { data, error } = await client.rpc('v2_send_pilot_commercial_offer', {
        p_company_id: company,
        p_proposal_id: proposal,
        p_expected: expected,
      });
      if (error?.code === '40001') throw new Error('A proposta mudou. Atualize a consulta.');
      if (error) throw new Error('Não foi possível enviar a proposta no Workspace.');
      return z.literal(proposal).parse(data);
    },
    async emailCommercialOffer(company: string, proposal: string, expected: string) {
      const { data, error } = await client.functions.invoke('workspace-commercial-email', {
        body: { company, proposal, expected },
      });
      if (error) throw new Error('Não foi possível confirmar o envio de teste. Tente novamente.');
      return z
        .object({
          testLink: z.string().regex(/^http:\/\/127\.0\.0\.1:5173\/proposta-externa#[a-f0-9]{64}$/),
        })
        .parse(data).testLink;
    },
    async externalCommercialOffer(token: string, accept: boolean, signal?: AbortSignal) {
      const request = client.schema('public').rpc('v2_external_pilot_commercial_offer', {
        p_token: token,
        p_accept: accept,
      });
      const { data, error } = await (signal ? request.abortSignal(signal) : request);
      if (error) throw new Error('Não foi possível consultar ou aceitar esta proposta.');
      return externalOffer.nullable().parse(data);
    },
    async receivedOffers(company: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pilot_received_offers', { p_company_id: company })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar suas propostas.');
      return receivedOffers.parse(data);
    },
    async acceptCommercialOffer(company: string, proposal: string, version: number) {
      const { data, error } = await client.rpc('v2_accept_pilot_commercial_offer', {
        p_company_id: company,
        p_proposal_id: proposal,
        p_version: version,
      });
      if (error?.code === '40001') throw new Error('Confira a versão e a validade da proposta.');
      if (error) throw new Error('Não foi possível aceitar a proposta.');
      return z.literal(proposal).parse(data);
    },
    async saveCommercialDraft(
      company: string,
      proposal: string,
      expected: string,
      change?: CommercialDraftChange,
    ) {
      const { data, error } = await client.rpc('v2_save_pilot_commercial_draft', {
        p_company_id: company,
        p_proposal_id: proposal,
        p_expected: expected,
        p_action: change ? 'edit' : 'approve',
        p_payment_terms: change?.paymentTerms ?? null,
        p_public_notes: change?.publicNotes ?? null,
        p_validity_days: change?.validityDays ?? null,
      });
      if (error?.code === '40001') throw new Error('A proposta mudou. Atualize a consulta.');
      if (error?.code === '42501')
        throw new Error('Seu acesso não permite editar esta proposta no Portal.');
      if (error) throw new Error('Não foi possível salvar a proposta.');
      return z.literal(proposal).parse(data);
    },
    async commercial(company: string, page: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pilot_commercial', {
          p_company_id: company,
          p_page: page,
        })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar as propostas.');
      const result = commercial.parse(data);
      if (result.companyId !== company) throw new Error('Contexto divergente.');
      return result;
    },
  };
}

export type AdminReadService = ReturnType<typeof createAdminRead>;
