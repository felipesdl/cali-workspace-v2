import { z } from 'zod';
import { type WorkspaceClient } from '../supabase';

const status = z.enum(['pending', 'accepted', 'returned']);
const fields = z.object({
  paymentTerms: z.string().nullable(),
  publicNotes: z.string().nullable(),
  validityDays: z.number().int().nullable(),
  decision: z.string().nullable(),
});
const adminDraft = fields.extend({ id: z.uuid(), state: status, author: z.string() });
const adminView = z.object({
  assigned: z.uuid().nullable(),
  options: z.array(z.object({ id: z.uuid(), name: z.string() })),
  draft: adminDraft.nullable(),
});
const partnerDraft = fields.extend({
  id: z.uuid(),
  protocol: z.string(),
  service: z.string(),
  expectedAt: z.iso.datetime({ offset: true }),
  state: status.nullable(),
  canSubmit: z.boolean(),
});
const partnerView = z.object({
  total: z.number().int().nonnegative(),
  rows: z.array(partnerDraft),
});
export type PartnerProposalRow = z.infer<typeof partnerDraft>;

export function createPartnerProposalDrafts(client: WorkspaceClient) {
  return {
    async admin(company: string, opportunity: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_partner_proposal_admin', { p_company: company, p_opportunity: opportunity })
        .abortSignal(signal);
      if (error) throw new Error('A revisão do parceiro não está disponível nesta proposta.');
      return adminView.parse(data);
    },
    async assign(company: string, opportunity: string, invite: string) {
      const { error } = await client.rpc('v2_assign_partner_proposal', {
        p_company: company,
        p_opportunity: opportunity,
        p_invite: invite,
      });
      if (error) throw new Error('Não foi possível atribuir a proposta ao parceiro.');
    },
    async list(company: string, page: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_list_partner_proposal_drafts', { p_company: company, p_page: page })
        .abortSignal(signal);
      if (error?.code === 'PGRST202' || error?.code === '42883') return { total: 0, rows: [] };
      if (error) throw new Error('Não foi possível consultar suas propostas.');
      return partnerView.parse(data);
    },
    async submit(
      company: string,
      row: PartnerProposalRow,
      request: string,
      payment: string,
      notes: string,
      validity: number,
    ) {
      const { data, error } = await client.rpc('v2_submit_partner_proposal_draft', {
        p_company: company,
        p_opportunity: row.id,
        p_expected: row.expectedAt,
        p_request: request,
        p_payment: payment,
        p_notes: notes,
        p_validity: validity,
      });
      if (error)
        throw new Error('Não foi possível enviar para revisão. Confira se a proposta mudou.');
      return z.literal(request).parse(data);
    },
    async decide(
      company: string,
      opportunity: string,
      draft: string,
      approve: boolean,
      note: string,
    ) {
      const { data, error } = await client.rpc('v2_decide_partner_proposal_draft', {
        p_company: company,
        p_opportunity: opportunity,
        p_draft: draft,
        p_accept: approve,
        p_note: note,
      });
      if (error)
        throw new Error('Não foi possível registrar a decisão. Confira a versão da proposta.');
      return z.literal(draft).parse(data);
    },
  };
}
export type PartnerProposalDraftService = ReturnType<typeof createPartnerProposalDrafts>;
