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
  'commercial_proposal_approved',
  'form_draft_created',
  'form_draft_edited',
  'form_open',
  'form_closed',
  'form_response_triaged',
] as const;
export type AuditEvent = (typeof auditEvents)[number];

const page = z.object({ companyId: z.uuid(), total: z.number().int().nonnegative() });
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

const commercialDraft = z.object({
  id: z.uuid(),
  updatedAt: z.iso.datetime({ offset: true }),
  paymentTerms: z.string().nullable(),
  publicNotes: z.string().nullable(),
  validityDays: z.number().int().min(1).max(120),
});
type CommercialDraftChange = { paymentTerms: string; publicNotes: string; validityDays: number };
export function createAdminRead(client: WorkspaceClient) {
  return {
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
