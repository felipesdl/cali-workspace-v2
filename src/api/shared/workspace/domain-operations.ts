import { decodePdf, encodePdf, pdfPayload } from './pdf-payload';
import {
  encodeAttachment,
  maxAttachmentBytes,
  maxRecordAttachmentBatchBytes,
  stageAttachment,
} from './file-payload';
import { z } from 'zod';
import { type WorkspaceClient } from '../../supabase';
import { companyStatus } from '../../admin/companies/schemas';
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
  attachmentBatchesEnabled: z.boolean().optional(),
  stagedBatchesEnabled: z.boolean().optional(),
  imageAttachmentsEnabled: z.boolean().optional(),
  messages: z.array(
    z.object({
      id: z.uuid(),
      body: z.string(),
      author_role: z.string(),
      visibility: z.string(),
      created_at: z.string(),
      attachment: z.object({ fileName: z.string(), canWithdraw: z.boolean() }).nullish(),
      attachments: z
        .array(
          z.object({
            position: z.number().int().min(1).max(5),
            fileName: z.string(),
            canWithdraw: z.boolean(),
          }),
        )
        .max(5)
        .nullish(),
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

export const formQuestionKind = z.enum([
  'name',
  'email',
  'phone',
  'short_text',
  'long_text',
  'number',
  'date',
  'single_choice',
  'multi_choice',
  'yes_no',
  'scale',
  'statement',
  'file',
]);
const scaleBound = z.number().int().min(0).max(10);
const scaleLabel = z.string().trim().max(80);
const scaleSettings = {
  scaleMin: scaleBound.optional(),
  scaleMax: scaleBound.optional(),
  minLabel: scaleLabel.optional(),
  maxLabel: scaleLabel.optional(),
};
export const FORM_BRANCH_END = '__end';
const formBranch = z.object({
  when: z.string().min(1).max(300),
  goTo: z.union([z.uuid(), z.literal(FORM_BRANCH_END)]),
});
export const publicFormQuestion = z.object({
  ...scaleSettings,
  id: z.uuid(),
  kind: formQuestionKind,
  options: z.array(z.string()).max(26).optional(),
  logic: z.array(formBranch).max(26).optional(),
  label: z.string(),
  required: z.boolean(),
  accept: z.enum(['images_pdf', 'any']).optional(),
});
export type PublicFormQuestion = z.infer<typeof publicFormQuestion>;
const publicTextForm = z.discriminatedUnion('status', [
  z.object({ status: z.literal('closed') }),
  z.object({
    status: z.literal('open'),
    title: z.string(),
    description: z.string().nullable(),
    questions: z.array(publicFormQuestion).min(1).max(40),
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
      options: z.array(z.string()).nullish(),
      logic: z.array(formBranch).nullish().catch(null),
      required: z.boolean(),
      scaleMin: scaleBound.nullish(),
      scaleMax: scaleBound.nullish(),
      minLabel: scaleLabel.nullish(),
      maxLabel: scaleLabel.nullish(),
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
    ...scaleSettings,
    options: z.array(z.string().min(1).max(300)).max(26).optional(),
    kind: formQuestionKind,
    label: z.string().trim().min(1).max(400),
    required: z.boolean(),
  }),
  z.object({
    action: z.literal('edit_question'),
    ...scaleSettings,
    options: z.array(z.string().min(1).max(300)).max(26).optional(),
    id: z.string().min(1),
    label: z.string().trim().min(1).max(400),
    required: z.boolean(),
  }),
  z.object({
    action: z.literal('set_logic'),
    id: z.uuid(),
    logic: z.array(formBranch).max(26),
  }),
]);
export type FormDraftChange = z.infer<typeof formDraftChange>;

const formTriageResponse = z.object({
  id: z.uuid(),
  respondent_name: z.string().nullable(),
  submitted_at: z.string(),
  pdfAvailable: z.boolean().optional(),
  attachmentsAvailable: z.boolean().optional(),
  answers: z
    .array(z.object({ questionId: z.string(), question: z.string(), answer: z.string() }))
    .optional(),
  stage: z.string().nullable(),
  owner: z.string().nullable(),
});
export type FormTriageResponse = z.infer<typeof formTriageResponse>;
export const staffDraftModule = z.enum([
  'records',
  'projects',
  'hours',
  'calendar',
  'documents',
  'reports',
  'notices',
  'team',
  'people_map',
]);
export const mapaReviewStatus = z.enum(['novo', 'em_andamento', 'cancelado']);

export function createDomainOperations(client: WorkspaceClient) {
  return {
    async setStaffActive(
      company: string,
      request: string,
      member: string,
      revision: string,
      active: boolean,
    ) {
      const { data, error } = await client.rpc('v2_set_pilot_staff_active', {
        p_company_id: company,
        p_request_id: request,
        p_member_id: member,
        p_expected: revision,
        p_active: active,
      });
      if (error?.code === '40001') throw new Error('A situação mudou. Recarregue a equipe.');
      if (error) throw rejected(error.code);
      return z.literal(member).parse(data);
    },
    async saveStaffDraft(
      company: string,
      request: string,
      member: { id: string; revision: string } | null,
      details: { name: string; modules: z.infer<typeof staffDraftModule>[] } | null,
    ) {
      const { data, error } = await client.rpc('v2_save_pilot_staff_draft', {
        p_company_id: company,
        p_request_id: request,
        p_member_id: member?.id ?? null,
        p_expected: member?.revision ?? null,
        p_name: details?.name ?? null,
        p_modules: details?.modules ?? null,
        p_remove: details === null,
      });
      if (error) throw rejected(error.code);
      return z.uuid().parse(data);
    },
    async reviewMapa(
      company: string,
      id: string,
      revision: number,
      status: z.infer<typeof mapaReviewStatus>,
      opinion: string,
    ) {
      const { data, error } = await client.rpc('v2_review_pilot_mapa', {
        p_company_id: company,
        p_record_id: id,
        p_revision: revision,
        p_status: status,
        p_opinion: opinion,
      });
      if (error) throw rejected(error.code);
      return z.uuid().parse(data);
    },
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
    async submitPublicTextForm(
      slug: string,
      request: string,
      answers: Record<string, string | number | string[] | File>,
    ) {
      const encoded = Object.fromEntries(
        await Promise.all(
          Object.entries(answers).map(async ([id, value]) => [
            id,
            value instanceof File ? await encodePdf(value) : value,
          ]),
        ),
      );
      const { data, error } = await client
        .schema('public')
        .rpc('v2_submit_pilot_public_text_form', {
          p_slug: slug,
          p_request_id: request,
          p_answers: encoded,
        });
      if (error?.code === '42501') throw new Error('Este formulário não está recebendo respostas.');
      if (error?.code === 'P0001' || error?.code === '22023')
        throw new Error('Confira as respostas e tente novamente.');
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
    async resendReport(company: string, report: string, version: number, request: string) {
      const { data, error } = await client.rpc('v2_resend_pilot_report', {
        p_company: company,
        p_report: report,
        p_version: version,
        p_request: request,
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
            publicOpeningAvailable: z.boolean().optional(),
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
      if (error?.code === 'P4F03')
        throw new Error('Remova a regra da alternativa antes de excluir a opção.');
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
    async formResponsePdf(company: string, form: string, response: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pilot_form_pdf', {
          p_company_id: company,
          p_form_id: form,
          p_response_id: response,
        })
        .abortSignal(signal);
      if (error) throw rejected(error.code);
      const result = pdfPayload.parse(data);
      if (result.id !== response) throw rejected();
      return decodePdf(result);
    },
    async formResponseAttachments(company: string, form: string, response: string) {
      const { data, error } = await client.rpc('v2_list_pilot_form_attachments', {
        p_company_id: company,
        p_form_id: form,
        p_response_id: response,
      });
      if (error) throw rejected(error.code);
      const files = z
        .array(z.object({ id: z.string(), fileName: z.string(), path: z.string() }))
        .parse(data);
      return Promise.all(
        files.map(async ({ id, fileName, path }) => {
          if (/^https:\/\/(drive\.google\.com|docs\.google\.com)\//.test(path))
            return { id, fileName, url: path };
          const { data: signed, error: signError } = await client.storage
            .from('cali-forms')
            .createSignedUrl(path, 60);
          if (signError || !signed?.signedUrl) throw rejected();
          return { id, fileName, url: signed.signedUrl };
        }),
      );
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
      if (error?.code === '40001') throw new Error('O formulário mudou. Recarregue a lista.');
      if (error?.code === 'P4F02')
        throw new Error('Este formulário não é compatível com a coleta da V2.');
      if (error) throw rejected(error.code);
      return z.literal(id).parse(data);
    },
    async subjectHistory(
      company: string,
      kind: 'record' | 'delivery',
      id: string,
      page: number,
      signal: AbortSignal,
    ) {
      const { data, error } = await client
        .rpc('v2_read_subject_history', {
          p_company: company,
          p_kind: kind,
          p_subject: id,
          p_page: page,
        })
        .abortSignal(signal);
      if (error?.code === 'PGRST202' || error?.code === '42883') return null;
      if (error) throw rejected(error.code);
      return z
        .object({
          id: z.literal(id),
          total: z.number().int().nonnegative(),
          entries: z.array(
            z.discriminatedUnion('kind', [
              z.object({
                kind: z.literal('hours'),
                id: z.string(),
                at: z.iso.date(),
                title: z.string(),
                minutes: z.number().int().positive(),
              }),
              z.object({
                kind: z.literal('approval'),
                id: z.string(),
                at: z.iso.datetime({ offset: true }),
                title: z.string(),
              }),
            ]),
          ),
        })
        .parse(data);
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
    async recordAction(
      company: string,
      id: string,
      input: RecordAction,
      files: File[] = [],
      batch = false,
      staged = false,
    ) {
      const command = recordAction.parse(input);
      if (files.length) {
        if (command.action !== 'message') throw new Error('Anexe o arquivo na conversa.');
        if (batch) {
          if (
            files.length > 5 ||
            files.some(
              (file) =>
                file.size < 8 ||
                file.size > maxRecordAttachmentBatchBytes ||
                !/\.(pdf|png|jpe?g|webp|docx|xlsx|pptx)$/i.test(file.name),
            )
          )
            throw new Error('Selecione até cinco arquivos compatíveis de até 10 MiB cada.');
          if (files.reduce((bytes, file) => bytes + file.size, 0) > maxRecordAttachmentBatchBytes) {
            if (!staged) throw new Error('A mensagem pode ter até 10 MiB em anexos.');
            const scope = {
              p_company_id: company,
              p_request_id: id,
              p_record_id: command.record,
            };
            const manifest: Array<{ fileName: string; sha256: string }> = [];
            for (const [index, file] of files.entries()) {
              const { base64, sha256 } = await stageAttachment(file);
              const { error } = await client.rpc('v2_stage_pilot_record_attachment', {
                ...scope,
                p_position: index + 1,
                p_file_name: file.name,
                p_base64: base64,
              });
              if (error?.code === '22023')
                throw new Error('Confira o formato e o tamanho dos anexos.');
              if (error) throw rejected(error.code);
              manifest.push({ fileName: file.name, sha256 });
            }
            const { data, error } = await client.rpc('v2_post_pilot_staged_record_batch', {
              ...scope,
              p_body: command.body,
              p_internal: command.internal,
              p_manifest: manifest,
            });
            if (error?.code === '40001') throw new Error('O envio mudou. Tente novamente.');
            if (error) throw rejected(error.code);
            return z.uuid().parse(data);
          }
          const { data, error } = await client.rpc('v2_post_pilot_record_batch', {
            p_company_id: company,
            p_request_id: id,
            p_record_id: command.record,
            p_body: command.body,
            p_internal: command.internal,
            p_files: await Promise.all(
              files.map(async (file) => ({
                fileName: file.name,
                base64: await encodeAttachment(file),
              })),
            ),
          });
          if (error?.code === '22023')
            throw new Error('Confira o formato, o tamanho e a quantidade dos anexos.');
          if (error) throw rejected(error.code);
          return z.uuid().parse(data);
        }
        if (files.length !== 1) throw new Error('Selecione um único anexo.');
        const [file] = files;
        const pdf = file.name.toLowerCase().endsWith('.pdf');
        if (
          !pdf &&
          (!/\.(png|jpe?g|webp)$/i.test(file.name) ||
            file.size < 8 ||
            file.size > maxAttachmentBytes)
        )
          throw new Error('Selecione um PDF ou imagem PNG, JPEG ou WebP de até 2 MiB.');
        const params = {
          p_company_id: company,
          p_request_id: id,
          p_record_id: command.record,
          p_body: command.body,
          p_internal: command.internal,
          p_file_name: file.name,
        };
        const { data, error } = pdf
          ? await client.rpc('v2_post_pilot_record_pdf', {
              ...params,
              p_pdf_base64: await encodePdf(file),
            })
          : await client.rpc('v2_post_pilot_record_image', {
              ...params,
              p_image_base64: await encodeAttachment(file),
            });
        if (error?.code === '22023')
          throw new Error('Confira a mensagem e o formato do anexo de até 2 MiB.');
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
    async recordAttachment(
      company: string,
      record: string,
      message: string,
      signal: AbortSignal,
      position?: number,
    ) {
      const target = { p_company_id: company, p_record_id: record, p_message_id: message };
      const query =
        position === undefined
          ? client.rpc('v2_read_pilot_record_pdf', target)
          : client.rpc('v2_read_pilot_record_attachment', { ...target, p_position: position });
      const { data, error } = await query.abortSignal(signal);
      if (error?.code === '42501') throw new Error('Anexo indisponível para este acesso.');
      if (error) throw rejected(error.code);
      const result = pdfPayload
        .extend({
          position: z.number().optional(),
          content: z.string().max(14_200_000),
        })
        .parse(data);
      if (result.id !== message || result.position !== position) throw rejected();
      return decodePdf(result, 'anexo');
    },
    async withdrawRecordAttachment(
      company: string,
      record: string,
      message: string,
      reason: string,
      position?: number,
    ) {
      const target = {
        p_company_id: company,
        p_record_id: record,
        p_message_id: message,
        p_reason: z.string().trim().min(3).max(1000).parse(reason),
      };
      const { data, error } =
        position === undefined
          ? await client.rpc('v2_withdraw_pilot_record_pdf', target)
          : await client.rpc('v2_withdraw_pilot_record_attachment', {
              ...target,
              p_position: position,
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
    async exportCompanyData(company: string, recipient: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_export_pilot_company_data', { p_company_id: company, p_recipient: recipient })
        .abortSignal(signal);
      if (error) throw rejected(error.code);
      const exported = z
        .object({ company: z.object({ id: z.literal(company) }) })
        .passthrough()
        .parse(data);
      return {
        blob: new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' }),
        fileName: 'dados-cali-' + company + '.json',
      };
    },
    async previewCompanyElimination(company: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_preview_pilot_company_elimination', { p_company_id: company })
        .abortSignal(signal);
      if (error) throw rejected(error.code);
      const id = z.literal(company);
      return z
        .discriminatedUnion('eligible', [
          z.object({ companyId: id, eligible: z.literal(false) }),
          z.object({
            companyId: id,
            eligible: z.literal(true),
            legacyStorageObjects: z.number().int().nonnegative(),
            forms: z.number().int().nonnegative(),
            formsPdfs: z.number().int().nonnegative(),
            coverageReview: z
              .object({
                pathsOutsideLegacy: z.number().int().nonnegative(),
                externalReferences: z.number().int().nonnegative(),
                discCampaigns: z.number().int().nonnegative(),
                discResults: z.number().int().nonnegative(),
                discDispatches: z.number().int().nonnegative(),
              })
              .optional(),
            workspaceFiles: z
              .object({
                documentRevisions: z.number().int().nonnegative(),
                recordAttachments: z.number().int().nonnegative(),
                reportPdfs: z.number().int().nonnegative(),
                agendaPdfs: z.number().int().nonnegative(),
                expenseReceipts: z.number().int().nonnegative(),
                proposalPdfs: z.number().int().nonnegative(),
                exclusiveNoticeCovers: z.number().int().nonnegative(),
              })
              .optional(),
          }),
        ])
        .parse(data);
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
