import { z } from 'zod';
import type { WorkspaceClient } from '../supabase';

const draftState = z.enum(['draft', 'submitted', 'returned', 'materialized']);
const row = z.object({
  id: z.uuid(),
  companyId: z.uuid(),
  month: z.iso.date(),
  title: z.string(),
  summary: z.string(),
  status: draftState,
  updatedAt: z.iso.datetime({ offset: true }),
  submittedAt: z.iso.datetime({ offset: true }).nullable(),
  decisionNote: z.string().nullable(),
  reportId: z.uuid().nullable(),
});
const page = z.object({
  companyId: z.uuid(),
  total: z.number().int().nonnegative(),
  rows: z.array(row),
});
const adminRow = row.extend({
  authorId: z.uuid(),
  authorName: z.string(),
});
const adminPage = z.object({
  companyId: z.uuid(),
  total: z.number().int().nonnegative(),
  rows: z.array(adminRow),
});
const materialized = z.object({
  id: z.uuid(),
  reportId: z.uuid(),
  status: z.literal('materialized'),
});

export function createPartnerReportDrafts(client: WorkspaceClient) {
  return {
    async listPartner(company: string, pageNumber: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_list_partner_report_drafts', {
          p_company: company,
          p_page: pageNumber,
        })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar os rascunhos de relatório.');
      const result = page.parse(data);
      if (result.companyId !== company || result.rows.some((draft) => draft.companyId !== company))
        throw new Error('Empresa divergente.');
      return result;
    },
    async savePartner(
      company: string,
      draft: {
        id: string;
        expected: string | null;
        month: string;
        title: string;
        summary: string;
        submit: boolean;
      },
    ) {
      const { data, error } = await client.rpc('v2_save_partner_report_draft', {
        p_company: company,
        p_draft: z.uuid().parse(draft.id),
        p_expected: draft.expected,
        p_month: z.iso.date().parse(draft.month),
        p_title: z.string().trim().min(1).max(180).parse(draft.title),
        p_summary: z.string().trim().min(1).max(8000).parse(draft.summary),
        p_submit: draft.submit,
      });
      if (error?.code === '40001') throw new Error('O rascunho mudou. Atualize e tente novamente.');
      if (error) throw new Error('Não foi possível salvar o rascunho do relatório.');
      const saved = row.parse(data);
      if (saved.id !== draft.id || saved.companyId !== company)
        throw new Error('Rascunho divergente.');
      return saved;
    },
    async listAdmin(company: string, pageNumber: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_list_admin_partner_report_drafts', {
          p_company: company,
          p_page: pageNumber,
        })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar os rascunhos enviados pelo parceiro.');
      const result = adminPage.parse(data);
      if (result.companyId !== company || result.rows.some((draft) => draft.companyId !== company))
        throw new Error('Empresa divergente.');
      return result;
    },
    async returnDraft(company: string, draft: string, expected: string, note: string) {
      const { error } = await client.rpc('v2_return_partner_report_draft', {
        p_company: company,
        p_draft: draft,
        p_expected: expected,
        p_note: note.trim(),
      });
      if (error?.code === '40001') throw new Error('O rascunho mudou. Atualize e tente novamente.');
      if (error) throw new Error('Não foi possível devolver o relatório para ajuste.');
    },
    async materialize(company: string, draft: string, expected: string) {
      const { data, error } = await client.rpc('v2_materialize_partner_report_draft', {
        p_company: company,
        p_draft: z.uuid().parse(draft),
        p_expected: expected,
      });
      if (error?.code === '40001')
        throw new Error(
          'Confira se o rascunho ainda está atualizado e se o período já pode ser gerado.',
        );
      if (error) throw new Error('Não foi possível preparar o rascunho no Admin.');
      const result = materialized.parse(data);
      if (result.id !== draft) throw new Error('Rascunho divergente.');
      return result;
    },
  };
}

export type PartnerReportDraftService = ReturnType<typeof createPartnerReportDrafts>;
