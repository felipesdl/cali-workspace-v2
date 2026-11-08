import { decodePdf, encodePdf, pdfPayload } from './pdf-payload';
import { z } from 'zod';
import { type WorkspaceClient } from '../../supabase';
import { companyStatus } from '../companies/schemas';
import { reportCurationSchema, type ReportCuration } from './report-curation';
import { frontActivation, frontOptions, type FrontActivation } from './schemas';

const feedback = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
});
const reopen = z.object({
  id: z.uuid(),
  status: z.enum(['pending', 'approved', 'rejected']),
  reason: z.string().nullable(),
  note: z.string().nullable(),
});
export type RecordFeedback = z.infer<typeof feedback>;
export type RecordReopen = z.infer<typeof reopen>;
const noticeCoverMime = z.enum(['image/png', 'image/jpeg']);
const noticeCoverPayload = z.object({
  mimeType: noticeCoverMime,
  content: z
    .string()
    .max(1_420_000)
    .regex(/^[A-Za-z0-9+/=\s]+$/),
});
const noticeReaction = z.enum(['like', 'love', 'clap']);
export type NoticeReaction = z.infer<typeof noticeReaction>;
const noticeInteractions = z.object({
  canModerate: z.boolean().optional(),
  comments: z.array(
    z.object({
      id: z.uuid(),
      body: z.string(),
      authorRole: z.enum(['admin', 'client']),
      createdAt: z.string(),
      hidden: z.boolean().optional(),
      moderationVersion: z.uuid().nullish(),
    }),
  ),
  ownReaction: noticeReaction.nullable(),
  totals: z.record(noticeReaction, z.number().int().nonnegative()),
});

const records = z.object({
  id: z.uuid(),
  title: z.string(),
  status: z.string().nullable(),
  visibility: z.enum(['client', 'internal']).optional(),
  feedback: feedback.nullable().optional(),
  reopen: reopen.nullable().optional(),
  attachmentsEnabled: z.boolean().optional(),
  messages: z.array(
    z.object({
      id: z.uuid(),
      body: z.string(),
      author_role: z.string(),
      visibility: z.string(),
      created_at: z.string(),
      attachment: z.object({ fileName: z.string(), canWithdraw: z.boolean() }).nullish(),
    }),
  ),
});
const subjectKind = z.enum(['access', 'correction', 'deletion', 'other']);
const subjects = z.array(
  z.object({
    id: z.uuid(),
    kind: subjectKind,
    details: z.string(),
    status: z.string(),
    answer: z.string().nullable(),
    created_at: z.string(),
  }),
);
const readiness = z.object({
  mode: z.enum(['simulation', 'preview', 'official']),
  collected: z.number().int(),
  required: z.number().int(),
  availableOn: z.iso.date(),
});
const dataLifecycle = z.object({
  companyId: z.uuid(),
  status: z.enum(companyStatus),
  accessClosed: z.boolean(),
  closedAt: z.string().nullable(),
  eliminatedAt: z.string().nullable(),
  waitingPeriodMet: z.boolean(),
});
const recordAction = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('open'),
    record: z.uuid(),
    title: z.string().trim().min(2).max(180),
    body: z.string().trim().min(2).max(6000),
    internal: z.boolean(),
  }),
  z.object({
    action: z.literal('message'),
    record: z.uuid(),
    body: z.string().trim().min(1).max(6000),
    internal: z.boolean(),
  }),
  z.object({
    action: z.literal('change_status'),
    record: z.uuid(),
    expected: z.string(),
    next: z.enum(['in_progress', 'waiting_client', 'standby', 'completed', 'cancelled']),
  }),
]);
export type RecordAction = z.infer<typeof recordAction>;

const reviewBase = z.object({ record: z.uuid(), note: z.string().trim().max(2000) });
const reviewAction = z.discriminatedUnion('action', [
  reviewBase
    .extend({ action: z.literal('evaluate'), score: z.number().int().min(1).max(5) })
    .refine(
      (value) => value.score > 3 || value.note.length >= 3,
      'Informe o motivo para notas de 1 a 3.',
    ),
  reviewBase.extend({
    action: z.literal('request_reopen'),
    note: z.string().trim().min(3).max(2000),
  }),
  reviewBase.extend({ action: z.literal('approve_reopen'), reopen: z.uuid() }),
  reviewBase.extend({
    action: z.literal('reject_reopen'),
    reopen: z.uuid(),
    note: z.string().trim().min(3).max(2000),
  }),
]);
export type RecordReviewAction = z.infer<typeof reviewAction>;

function rejected(code?: string) {
  if (code === '40001') return new Error('O registro mudou. Confira a situação atual.');
  if (code === 'P4C01') return new Error('Avalie a ocorrência antes de pedir a reabertura.');
  if (code === 'P4R02') return new Error('Gere o PDF desta revisão antes de publicar.');
  if (code === 'P4R01') return new Error('Confira a assinatura e a foto configuradas da CALI.');
  if (code === '42501') return new Error('Operação indisponível para este perfil.');
  return new Error('Não foi possível concluir a operação.');
}

const formQuestionKind = z.enum(['short_text', 'long_text']);
const publicTextForm = z.discriminatedUnion('status', [
  z.object({ status: z.literal('closed') }),
  z.object({
    status: z.literal('open'),
    title: z.string(),
    description: z.string().nullable(),
    questions: z
      .array(
        z.object({
          id: z.uuid(),
          kind: formQuestionKind,
          label: z.string(),
          required: z.boolean(),
        }),
      )
      .min(1)
      .max(40),
  }),
]);
const formDraft = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string(),
  updatedAt: z.iso.datetime({ offset: true }),
  questions: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      kind: z.string(),
      required: z.boolean(),
    }),
  ),
});
export type FormDraft = z.infer<typeof formDraft>;
export type FormQuestionKind = z.infer<typeof formQuestionKind>;
const formDraftChange = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('details'),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(1200),
  }),
  z.object({
    action: z.literal('add_question'),
    kind: formQuestionKind,
    label: z.string().trim().min(1).max(400),
    required: z.boolean(),
  }),
  z.object({
    action: z.literal('edit_question'),
    id: z.string().min(1),
    label: z.string().trim().min(1).max(400),
    required: z.boolean(),
  }),
]);
export type FormDraftChange = z.infer<typeof formDraftChange>;

const formTriageResponse = z.object({
  id: z.uuid(),
  respondent_name: z.string().nullable(),
  submitted_at: z.string(),
  stage: z.string().nullable(),
  owner: z.string().nullable(),
});
export type FormTriageResponse = z.infer<typeof formTriageResponse>;

export function createDomainOperations(client: WorkspaceClient) {
  return {
    async frontOptions(company: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_list_pilot_front_options', { p_company_id: company })
        .abortSignal(signal);
      if (error) throw rejected(error.code);
      return frontOptions.parse(data);
    },
    async activateFront(company: string, request: string, input: FrontActivation) {
      const front = frontActivation.parse(input);
      const { data, error } = await client.rpc('v2_activate_pilot_front', {
        p_company_id: company,
        p_request_id: request,
        p_code: front.code,
        p_mode: front.mode,
        p_scope: front.scope,
        p_start: front.startsOn,
        p_end: front.endsOn,
      });
      if (error?.code === 'P4F01') throw new Error('Defina um plano ativo para esta empresa.');
      if (error?.code === 'P0001')
        throw new Error('O plano, a vigência ou as vagas disponíveis impedem a ativação.');
      if (error) throw rejected(error.code);
      return z.literal(request).parse(data);
    },
    async endFront(company: string, id: string) {
      const { data, error } = await client.rpc('v2_end_pilot_front', {
        p_company_id: company,
        p_front_id: id,
      });
      if (error) throw rejected(error.code);
      return z.literal(id).parse(data);
    },
    async publishNotice(
      company: string,
      id: string,
      category: string,
      title: string,
      body: string,
      day: string,
    ) {
      const { data, error } = await client.rpc('v2_publish_pilot_notice', {
        p_company_id: company,
        p_notice_id: id,
        p_category: z.enum(['feriado', 'atendimento', 'comunicado']).parse(category),
        p_title: title,
        p_body: body,
        p_date: z.iso.date().parse(day),
      });
      if (error) throw rejected(error.code);
      return z.uuid().parse(data);
    },
    async noticeState(
      company: string,
      id: string,
      current: string,
      next: 'published' | 'archived',
    ) {
      const { data, error } = await client.rpc('v2_set_pilot_notice_state', {
        p_company_id: company,
        p_notice_id: id,
        p_expected: current,
        p_next: next,
      });
      if (error) throw rejected(error.code);
      return z.uuid().parse(data);
    },
    async noticeAcknowledgment(company: string, id: string, confirm: boolean) {
      const { data, error } = await client.rpc('v2_ack_pilot_notice', {
        p_company_id: company,
        p_notice_id: id,
        p_confirm: confirm,
      });
      if (error) throw rejected(error.code);
      return z.uuid().parse(data);
    },
    async readPublicTextForm(slug: string, signal: AbortSignal) {
      const { data, error } = await client
        .schema('public')
        .rpc('v2_read_pilot_public_text_form', { p_slug: slug })
        .abortSignal(signal);
      if (error) throw rejected(error.code);
      return publicTextForm.nullable().parse(data);
    },
    async submitPublicTextForm(slug: string, request: string, answers: Record<string, string>) {
      const { data, error } = await client
        .schema('public')
        .rpc('v2_submit_pilot_public_text_form', {
          p_slug: slug,
          p_request_id: request,
          p_answers: answers,
        });
      if (error?.code === '42501') throw new Error('Este formulário não está recebendo respostas.');
      if (error?.code === 'P0001') throw new Error('Confira as respostas e tente novamente.');
      if (error) throw rejected(error.code);
      return z.literal(true).parse(data);
    },
    async saveNoticeCover(
      company: string,
      notice: string,
      request: string,
      version: string | null,
      file: File | null,
    ) {
      const mime = file && noticeCoverMime.safeParse(file.type);
      if (file && (!mime || !mime.success || file.size < 12 || file.size > 1024 * 1024))
        throw new Error('Selecione um PNG ou JPEG de até 1 MiB.');
      const bytes = file ? new Uint8Array(await file.arrayBuffer()) : null;
      let binary = '';
      if (bytes) {
        for (let offset = 0; offset < bytes.length; offset += 8192) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
        }
      }
      const { data, error } = await client.rpc('v2_save_pilot_notice_cover', {
        p_company_id: company,
        p_notice_id: notice,
        p_request_id: request,
        p_expected: version,
        p_mime: file?.type ?? null,
        p_base64: file ? btoa(binary) : null,
      });
      if (error) throw rejected(error.code);
      return z.uuid().parse(data);
    },
    async noticeCover(company: string, notice: string, version: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pilot_notice_cover', {
          p_company_id: company,
          p_notice_id: notice,
          p_cover_id: version,
        })
        .abortSignal(signal);
      if (error) throw rejected(error.code);
      const cover = noticeCoverPayload.parse(data);
      return `data:${cover.mimeType};base64,${cover.content.replace(/\s/g, '')}`;
    },
    async noticeInteractions(company: string, id: string, page: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pilot_notice_interactions', {
          p_company_id: company,
          p_notice_id: id,
          p_page: page,
        })
        .abortSignal(signal);
      if (error) throw rejected(error.code);
      return noticeInteractions.parse(data);
    },
    async commentNotice(company: string, id: string, request: string, body: string) {
      const { data, error } = await client.rpc('v2_comment_pilot_notice', {
        p_company_id: company,
        p_request_id: request,
        p_notice_id: id,
        p_body: z.string().trim().min(1).max(2000).parse(body),
      });
      if (error) throw rejected(error.code);
      return z.uuid().parse(data);
    },
    async moderateNoticeComment(
      company: string,
      notice: string,
      request: string,
      comment: z.infer<typeof noticeInteractions>['comments'][number],
      reason: string,
    ) {
      const { data, error } = await client.rpc('v2_moderate_pilot_notice_comment', {
        p_company_id: company,
        p_notice_id: notice,
        p_comment_id: comment.id,
        p_request_id: request,
        p_expected: comment.moderationVersion ?? null,
        p_hidden: !comment.hidden,
        p_reason: z.string().trim().min(5).max(1000).parse(reason),
      });
      if (error?.code === '40001') throw new Error('O comentário mudou. Confira o estado atual.');
      if (error) throw new Error('Não foi possível moderar o comentário.');
      return z.literal(comment.id).parse(data);
    },
    async reactNotice(company: string, id: string, expected: NoticeReaction | null, next: string) {
      const { data, error } = await client.rpc('v2_react_pilot_notice', {
        p_company_id: company,
        p_notice_id: id,
        p_expected: expected,
        p_reaction: next === '' ? null : noticeReaction.parse(next),
      });
      if (error) throw rejected(error.code);
      return z.literal(id).parse(data);
    },
    async createReport(company: string, id: string, month: string, title: string, summary: string) {
      const { data, error } = await client.rpc('v2_create_pilot_report_draft', {
        p_company_id: company,
        p_report_id: id,
        p_month: z.iso.date().parse(month),
        p_title: title,
        p_summary: summary,
      });
      if (error) throw rejected(error.code);
      return z.uuid().parse(data);
    },
    async updateReport(
      company: string,
      id: string,
      expected: string,
      action: 'edit' | 'review' | 'approve' | 'reopen',
      text?: string,
    ) {
      const { data, error } = await client.rpc('v2_update_pilot_report_draft', {
        p_company_id: company,
        p_report_id: id,
        p_expected: expected,
        p_action: action,
        p_summary: text ?? null,
      });
      if (error) throw rejected(error.code);
      return z.uuid().parse(data);
    },
    async curateReport(company: string, id: string, expected: string, sections: ReportCuration) {
      const { data, error } = await client.rpc('v2_curate_pilot_report', {
        p_company_id: company,
        p_report_id: id,
        p_expected: expected,
        p_sections: reportCurationSchema.parse(sections),
      });
      if (error) throw rejected(error.code);
      return z.literal(id).parse(data);
    },
    async reportApprovals(company: string, report: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_list_pilot_report_approvals', {
          p_company_id: company,
          p_report_id: report,
          p_page: 1,
        })
        .abortSignal(signal);
      if (error) throw rejected(error.code);
      return z
        .array(
          z.object({
            version: z.number().int().positive(),
            approvedAt: z.string(),
            protocol: z.string().nullable(),
            pdfReady: z.boolean().optional(),
          }),
        )
        .parse(data);
    },
    async generateReportPdf(companyId: string, reportId: string, version: number) {
      const { data, error } = await client.functions.invoke('workspace-executive-pdf', {
        body: { companyId, reportId, version },
      });
      if (error)
        throw new Error('Não foi possível gerar o PDF. Confira a coleta, a foto e a assinatura.');
      return z.object({ id: z.literal(reportId) }).parse(data).id;
    },
    async releaseReport(company: string, report: string, version: number, requestAck: boolean) {
      const { data, error } = await client.rpc('v2_release_pilot_report', {
        p_company_id: company,
        p_report_id: report,
        p_version: version,
        p_request_ack: requestAck,
      });
      if (error) throw rejected(error.code);
      return z.literal(report).parse(data);
    },
    async reportPdf(company: string, report: string, version: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pilot_report_pdf', {
          p_company_id: company,
          p_report_id: report,
          p_version: version,
        })
        .abortSignal(signal);
      if (error) throw rejected(error.code);
      return decodePdf(
        pdfPayload.extend({ id: z.literal(report), version: z.literal(version) }).parse(data),
      );
    },
    async acknowledgeReportRelease(company: string, report: string, version: number) {
      const { data, error } = await client.rpc('v2_ack_pilot_report_release', {
        p_company_id: company,
        p_report_id: report,
        p_version: version,
      });
      if (error) throw rejected(error.code);
      return z.literal(report).parse(data);
    },
    async forms(company: string, page: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_list_pilot_forms', {
          p_company_id: company,
          p_page: page,
        })
        .abortSignal(signal);
      if (error) throw rejected(error.code);
      return z
        .array(
          z.object({
            id: z.uuid(),
            slug: z.string(),
            title: z.string(),
            status: z.enum(['draft', 'open', 'closed']),
            responses: z.number().int().nonnegative(),
            publicTextLink: z.boolean().optional(),
            textExportAvailable: z.boolean().optional(),
          }),
        )
        .parse(data);
    },
    async createFormDraft(company: string, id: string, title: string, slug: string) {
      const { data, error } = await client.rpc('v2_create_pilot_form_draft', {
        p_company_id: company,
        p_form_id: id,
        p_title: title,
        p_slug: slug,
      });
      if (error?.code === '23505') throw new Error('Este endereço já está em uso.');
      if (error?.code === '22023')
        throw new Error('Confira o título e use letras minúsculas, números ou hífens no endereço.');
      if (error) throw rejected(error.code);
      return z.literal(id).parse(data);
    },
    async formDraft(company: string, id: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pilot_form_draft', {
          p_company_id: company,
          p_form_id: id,
        })
        .abortSignal(signal);
      if (error) throw rejected(error.code);
      const draft = formDraft.nullable().parse(data);
      if (draft && draft.id !== id) throw rejected();
      return draft;
    },
    async editFormDraft(company: string, draft: FormDraft, input: FormDraftChange) {
      const { action, ...fields } = formDraftChange.parse(input);
      const { data, error } = await client.rpc('v2_edit_pilot_form_draft', {
        p_company_id: company,
        p_form_id: draft.id,
        p_expected: draft.updatedAt,
        p_action: action,
        p_fields: fields,
      });
      if (error?.code === '22023')
        throw new Error('Confira o texto. Use texto simples, sem marcação.');
      if (error) throw rejected(error.code);
      return z.literal(draft.id).parse(data);
    },
    async formTriage(company: string, id: string, page: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_list_pilot_form_triage', { p_company_id: company, p_form_id: id, p_page: page })
        .abortSignal(signal);
      if (error) throw rejected(error.code);
      return z
        .object({
          stages: z.array(z.string()),
          responses: z.array(formTriageResponse),
        })
        .nullable()
        .parse(data);
    },
    async formExport(company: string, form: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_export_pilot_form_responses', { p_company_id: company, p_form_id: form })
        .abortSignal(signal);
      if (error?.code === 'P4F01') throw new Error('A coleta excede o limite da exportação.');
      if (error) throw rejected(error.code);
      return z
        .object({
          slug: z.string().regex(/^[a-z0-9-]{1,100}$/),
          questions: z
            .array(z.object({ label: z.string() }))
            .min(1)
            .max(40),
          responses: z
            .array(
              z.object({
                submittedAt: z.iso.datetime({ offset: true }),
                stage: z.string().nullable(),
                owner: z.string().nullable(),
                values: z.array(z.string()).max(40),
              }),
            )
            .max(500),
        })
        .parse(data);
    },
    async saveFormTriage(
      company: string,
      form: string,
      response: FormTriageResponse,
      stage: string,
      owner: string,
    ) {
      const { data, error } = await client.rpc('v2_save_pilot_form_triage', {
        p_company_id: company,
        p_form_id: form,
        p_response_id: response.id,
        p_expected_stage: response.stage,
        p_expected_owner: response.owner,
        p_stage: stage,
        p_owner: owner,
      });
      if (error?.code === '22023') throw new Error('Confira a etapa e o responsável.');
      if (error) throw rejected(error.code);
      return z.literal(response.id).parse(data);
    },
    async closeForm(company: string, id: string) {
      const { data, error } = await client.rpc('v2_set_pilot_form_state', {
        p_company_id: company,
        p_form_id: id,
        p_expected: 'open',
        p_next: 'closed',
      });
      if (error) throw rejected(error.code);
      return z.literal(id).parse(data);
    },
    async openPublicForm(
      company: string,
      id: string,
      current: 'draft' | 'closed',
      confirmed: boolean,
    ) {
      if (!confirmed) throw new Error('Confirme que o formulário ficará público por link.');
      const { data, error } = await client.rpc('v2_open_pilot_public_form', {
        p_company_id: company,
        p_form_id: id,
        p_expected: current,
        p_confirm_public: confirmed,
      });
      if (error?.code === '40001')
        throw new Error('O formulário mudou, está sem perguntas ou tem confirmação por e-mail.');
      if (error) throw rejected(error.code);
      return z.literal(id).parse(data);
    },
    async readRecord(company: string, record: string, page: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pilot_record', { p_company_id: company, p_record_id: record, p_page: page })
        .abortSignal(signal);
      if (error) throw rejected(error.code);
      const result = records.nullable().parse(data);
      if (result && result.id !== record) throw rejected();
      return result;
    },
    async recordAction(company: string, id: string, input: RecordAction, file?: File) {
      const command = recordAction.parse(input);
      if (file) {
        if (command.action !== 'message') throw new Error('Anexe o PDF na conversa.');
        const { data, error } = await client.rpc('v2_post_pilot_record_pdf', {
          p_company_id: company,
          p_request_id: id,
          p_record_id: command.record,
          p_body: command.body,
          p_internal: command.internal,
          p_file_name: file.name,
          p_pdf_base64: await encodePdf(file),
        });
        if (error?.code === '22023') throw new Error('Confira a mensagem e o PDF de até 2 MiB.');
        if (error) throw rejected(error.code);
        return z.uuid().parse(data);
      }
      const { data, error } = await client.rpc('v2_pilot_record_action', {
        p_company_id: company,
        p_request_id: id,
        p_record_id: command.record,
        p_action: command.action,
        p_title: 'title' in command ? command.title : null,
        p_body: 'body' in command ? command.body : null,
        p_internal: 'internal' in command && command.internal,
        p_expected_status: 'expected' in command ? command.expected : null,
        p_next_status: 'next' in command ? command.next : null,
      });
      if (error) throw rejected(error.code);
      return z.uuid().parse(data);
    },
    async recordPdf(company: string, record: string, message: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pilot_record_pdf', {
          p_company_id: company,
          p_record_id: record,
          p_message_id: message,
        })
        .abortSignal(signal);
      if (error?.code === '42501') throw new Error('Anexo indisponível para este acesso.');
      if (error) throw rejected(error.code);
      const result = pdfPayload.parse(data);
      if (result.id !== message) throw rejected();
      return decodePdf(result);
    },
    async withdrawRecordPdf(company: string, record: string, message: string, reason: string) {
      const { data, error } = await client.rpc('v2_withdraw_pilot_record_pdf', {
        p_company_id: company,
        p_record_id: record,
        p_message_id: message,
        p_reason: z.string().trim().min(3).max(1000).parse(reason),
      });
      if (error) throw rejected(error.code);
      return z.literal(message).parse(data);
    },
    async reviewRecord(company: string, id: string, input: RecordReviewAction) {
      const parsed = reviewAction.safeParse(input);
      if (!parsed.success)
        throw new Error('Confira a nota e o motivo. Notas de 1 a 3 exigem comentário.');
      const command = parsed.data;
      const { data, error } = await client.rpc('v2_review_pilot_record', {
        p_company_id: company,
        p_request_id: id,
        p_record_id: command.record,
        p_action: command.action,
        p_score: 'score' in command ? command.score : null,
        p_note: command.note || null,
        p_reopen_id: 'reopen' in command ? command.reopen : null,
      });
      if (error) throw rejected(error.code);
      return z.uuid().parse(data);
    },
    async reportReadiness(company: string, month: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_pilot_report_readiness', {
          p_company_id: company,
          p_period: z.iso.date().parse(month),
        })
        .abortSignal(signal);
      if (error) throw rejected(error.code);
      return readiness.parse(data);
    },
    async acknowledge(company: string, report: string) {
      const { data, error } = await client.rpc('v2_acknowledge_pilot_report', {
        p_company_id: company,
        p_report_id: report,
      });
      if (error) throw rejected(error.code);
      return z.object({ at: z.string(), protocol: z.string() }).parse(data);
    },
    async privacyRequests(company: string, page: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_list_pilot_privacy_requests', { p_company_id: company, p_page: page })
        .abortSignal(signal);
      if (error) throw rejected(error.code);
      return subjects.parse(data);
    },
    async dataLifecycle(company: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pilot_data_lifecycle', { p_company_id: company })
        .abortSignal(signal);
      if (error) throw rejected(error.code);
      const result = dataLifecycle.parse(data);
      if (result.companyId !== company) throw rejected();
      return result;
    },
    async submitPrivacy(company: string, id: string, kind: string, details: string) {
      const { data, error } = await client.rpc('v2_submit_pilot_privacy_request', {
        p_company_id: company,
        p_request_id: id,
        p_kind: subjectKind.parse(kind),
        p_details: z.string().trim().min(5).max(2000).parse(details),
      });
      if (error) throw rejected(error.code);
      return z.uuid().parse(data);
    },
    async answerPrivacy(company: string, request: string, answer: string) {
      const { data, error } = await client.rpc('v2_answer_pilot_privacy_request', {
        p_company_id: company,
        p_subject_request_id: request,
        p_answer: z.string().trim().min(5).max(4000).parse(answer),
      });
      if (error) throw rejected(error.code);
      return z.uuid().parse(data);
    },
  };
}

export type DomainOperations = ReturnType<typeof createDomainOperations>;
