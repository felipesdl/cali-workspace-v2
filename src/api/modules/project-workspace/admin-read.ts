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
] as const;
export type AuditEvent = (typeof auditEvents)[number];

const page = z.object({ companyId: z.uuid(), total: z.number().int().nonnegative() });
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

export function createAdminRead(client: WorkspaceClient) {
  return {
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
