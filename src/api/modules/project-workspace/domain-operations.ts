import { z } from 'zod';
import { type WorkspaceClient } from '../../supabase';

const records = z.object({
  id: z.uuid(),
  title: z.string(),
  status: z.string().nullable(),
  messages: z.array(
    z.object({
      id: z.uuid(),
      body: z.string(),
      author_role: z.string(),
      visibility: z.string(),
      created_at: z.string(),
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

function rejected(code?: string) {
  if (code === '40001') return new Error('O registro mudou. Confira a situação atual.');
  if (code === 'P4R01') return new Error('Confira a assinatura e a foto configuradas da CALI.');
  if (code === '42501') return new Error('Operação indisponível para este perfil.');
  return new Error('Não foi possível concluir a operação.');
}

export function createDomainOperations(client: WorkspaceClient) {
  return {
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
          }),
        )
        .parse(data);
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
          }),
        )
        .parse(data);
    },
    async formState(company: string, id: string, current: string, next: 'open' | 'closed') {
      const { data, error } = await client.rpc('v2_set_pilot_form_state', {
        p_company_id: company,
        p_form_id: id,
        p_expected: current,
        p_next: next,
      });
      if (error) throw rejected(error.code);
      return z.uuid().parse(data);
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
    async recordAction(company: string, id: string, input: RecordAction) {
      const command = recordAction.parse(input);
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
