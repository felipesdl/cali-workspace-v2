import { z } from 'zod';
import { type WorkspaceClient } from '../../supabase';

const action = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('edit-plan'),
    project: z.uuid(),
    item: z.uuid(),
    itemKind: z.enum(['project', 'workstream', 'deliverable']),
    expected: z.string().min(1),
    decision: z.enum(['save', 'remove']),
    name: z.string().trim().max(180),
    description: z.string().trim().max(8000),
    start: z.iso.date().nullable(),
    due: z.iso.datetime({ local: true }).nullable(),
    workstream: z.uuid().nullable(),
    complexity: z.enum(['MC1', 'MC2', 'MC3']).nullable(),
    position: z.number().int().min(1).max(100000).nullable(),
  }),
  z.object({
    kind: z.literal('create-project'),
    id: z.uuid(),
    name: z.string().trim().min(1).max(180),
    description: z.string().trim().max(8000),
    start: z.iso.date(),
  }),
  z.object({
    kind: z.literal('add-workstream'),
    project: z.uuid(),
    id: z.uuid(),
    name: z.string().trim().min(1).max(180),
  }),
  z.object({
    kind: z.literal('add-deliverable'),
    project: z.uuid(),
    id: z.uuid(),
    name: z.string().trim().min(1).max(180),
    workstream: z.uuid().nullable(),
    due: z.iso.datetime({ local: true }),
  }),
  z.object({
    kind: z.literal('deliverable'),
    project: z.uuid(),
    delivery: z.uuid(),
    expected: z.string().min(1),
    decision: z.enum(['status', 'reopen', 'approve', 'adjust']),
    status: z
      .enum([
        'in_progress',
        'internal_review',
        'client_review',
        'standby',
        'rebriefing',
        'cancelled',
      ])
      .optional(),
    note: z.string().trim().max(4000),
    score: z.number().int().min(1).max(5).optional(),
  }),
  z.object({
    kind: z.literal('lifecycle'),
    item: z
      .object({ id: z.uuid(), kind: z.enum(['front', 'deliverable']), version: z.string().min(1) })
      .optional(),
    project: z.uuid(),
    expected: z.string(),
    decision: z.enum(['pause', 'suspend', 'cancel', 'resume']),
    note: z.string().trim().min(4).max(4000),
    resume: z.iso.date().nullable(),
  }),
  z.object({ kind: z.literal('share'), project: z.uuid() }),
  z.object({
    kind: z.literal('respond'),
    project: z.uuid(),
    review: z.uuid(),
    decision: z.enum(['approve', 'request_adjustment', 'accept_adjustment', 'reject_adjustment']),
    note: z.string().trim().max(4000),
    targetType: z.enum(['project', 'workstream', 'deliverable']).optional(),
    target: z.uuid().optional(),
    itemAction: z.enum(['reschedule', 'swap_order', 'change_proposal']).optional(),
    requestedDate: z.iso.date().optional(),
    swap: z.uuid().optional(),
  }),
]);
export type ProjectAction = z.infer<typeof action>;

export function createProjectOperations(client: WorkspaceClient) {
  return async function operate(companyId: string, request: ProjectAction) {
    const company = z.uuid().parse(companyId);
    const command = action.parse(request);
    const scope = { p_company_id: company };
    function invoke() {
      switch (command.kind) {
        case 'edit-plan':
          return client.rpc('v2_edit_pilot_plan', {
            ...scope,
            p_project_id: command.project,
            p_item_id: command.item,
            p_kind: command.itemKind,
            p_expected: command.expected,
            p_action: command.decision,
            p_name: command.name,
            p_description: command.description,
            p_start: command.start,
            p_due: command.due,
            p_workstream_id: command.workstream,
            p_complexity: command.complexity,
            p_position: command.position,
          });
        case 'create-project':
          return client.rpc('v2_create_pilot_project', {
            ...scope,
            p_project_id: command.id,
            p_name: command.name,
            p_description: command.description,
            p_start: command.start,
          });
        case 'add-workstream':
        case 'add-deliverable':
          return client.rpc('v2_add_pilot_project_item', {
            ...scope,
            p_project_id: command.project,
            p_item_id: command.id,
            p_name: command.name,
            p_kind: command.kind === 'add-workstream' ? 'workstream' : 'deliverable',
            p_workstream_id: command.kind === 'add-deliverable' ? command.workstream : null,
            p_due: command.kind === 'add-deliverable' ? command.due : null,
          });
        case 'deliverable':
          return client.rpc('v2_pilot_delivery_action', {
            ...scope,
            p_project_id: command.project,
            p_delivery_id: command.delivery,
            p_expected: command.expected,
            p_action: command.decision,
            p_status: command.status ?? null,
            p_note: command.note,
            p_score: command.score ?? null,
          });
        case 'lifecycle':
          if (command.item)
            return client.rpc('v2_pilot_project_item_lifecycle', {
              ...scope,
              p_project_id: command.project,
              p_item_id: command.item.id,
              p_kind: command.item.kind,
              p_expected: command.item.version,
              p_action: command.decision,
              p_note: command.note,
              p_resume: command.resume,
            });
          return client.rpc('v2_pilot_project_lifecycle', {
            ...scope,
            p_project_id: command.project,
            p_expected: command.expected,
            p_action: command.decision,
            p_note: command.note,
            p_resume: command.resume,
          });
        case 'share':
          return client.rpc('v2_share_pilot_schedule', { ...scope, p_project_id: command.project });
        case 'respond':
          return client.rpc('v2_respond_pilot_schedule', {
            ...scope,
            p_project_id: command.project,
            p_review_id: command.review,
            p_action: command.decision,
            p_note: command.note,
            p_target_type: command.targetType ?? null,
            p_target_id: command.target ?? null,
            p_item_action: command.itemAction ?? null,
            p_requested_date: command.requestedDate ?? null,
            p_swap_id: command.swap ?? null,
          });
      }
    }
    const { data, error } = await invoke();
    if (error?.code === '40001')
      throw new Error('O registro mudou. Confira a versão atual e tente novamente.');
    if (error?.code === '42501') throw new Error('Operação indisponível para este perfil.');
    if (error?.code === 'P4D01') throw new Error('Anexe uma nova revisão do PDF antes de enviar.');
    if (error?.code === '22023') throw new Error('Revise os dados da operação.');
    if (error)
      throw new Error('Não foi possível concluir. Confira a composição e o estado do projeto.');
    return z.uuid().parse(data);
  };
}

export type ProjectOperations = ReturnType<typeof createProjectOperations>;

const timer = z.object({
  id: z.uuid(),
  description: z.string().nullable(),
  status: z.enum(['active', 'paused']),
  closedSegment: z.boolean().optional(),
  startedAt: z.string(),
});
const hourFields = z.object({
  description: z.string().trim().min(1).max(1000),
  project: z.uuid().nullable(),
  visible: z.boolean(),
});
const hourAction = z.discriminatedUnion('kind', [
  hourFields.extend({
    kind: z.literal('manual'),
    date: z.iso.date(),
    minutes: z.number().int().min(1).max(1440),
    note: z.string().trim().min(1).max(1000),
  }),
  hourFields.extend({ kind: z.literal('start') }),
  z.object({ kind: z.enum(['pause', 'resume', 'stop']), timer: z.uuid() }),
]);
export type HourAction = z.infer<typeof hourAction>;

export function createHourOperations(client: WorkspaceClient) {
  return {
    async timers(company: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_pilot_active_timers', { p_company_id: company })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível carregar os timers.');
      return z.array(timer).parse(data);
    },
    async submit(company: string, requestId: string, input: HourAction) {
      const command = hourAction.parse(input);
      const params = {
        p_company_id: company,
        p_request_id: requestId,
        p_action: command.kind,
      };
      const { data, error } = await client.rpc(
        'v2_pilot_hour_action',
        'timer' in command
          ? { ...params, p_timer_id: command.timer }
          : {
              ...params,
              p_project_id: command.project,
              p_description: command.description,
              p_client_visible: command.visible,
              p_date: command.kind === 'manual' ? command.date : null,
              p_minutes: command.kind === 'manual' ? command.minutes : null,
              p_note: command.kind === 'manual' ? command.note : null,
            },
      );
      if (error?.code === '40001') throw new Error('Confira o estado atual do timer.');
      if (error?.code === '22023') throw new Error('Revise os dados de horas.');
      if (error) throw new Error('Não foi possível registrar a operação de horas.');
      return z.uuid().parse(data);
    },
  };
}
export type HourOperations = ReturnType<typeof createHourOperations>;
