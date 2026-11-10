import { z } from 'zod';
import { type WorkspaceClient } from '../../supabase';

export const deliveryComplexity = z.enum(['MC1', 'MC2', 'MC3']);
export const taskAdminStatus = z.enum([
  'todo',
  'doing',
  'standby',
  'internal_review',
  'client_review',
  'done',
  'cancelled',
]);
export const taskStatus = taskAdminStatus.or(z.literal('approved'));
export const deadlineCause = z.enum(['client_dependency', 'scope', 'internal', 'other']);
const projectScope = z.object({ company: z.uuid(), project: z.uuid() });
const assignee = z.object({ id: z.uuid(), name: z.string() });
const summary = z.object({
  companyId: z.uuid(),
  projectId: z.uuid(),
  deliveryId: z.uuid().nullable(),
  total: z.number().int().nonnegative(),
  assignees: z.array(assignee),
});
const note = z.string().nullable();
const instant = z.string();
const instantOrNull = instant.nullable();
const task = z.object({
  id: z.uuid(),
  title: z.string(),
  description: note,
  status: taskStatus,
  due: instantOrNull,
  visible: z.boolean(),
  updatedAt: instant,
  complexity: deliveryComplexity.nullable(),
  adjustments: z.number().int().nonnegative(),
  estimatedMinutes: z.number().int().nullable(),
  assignee: z.uuid().nullable(),
});
const message = z.object({
  id: z.uuid(),
  body: z.string(),
  role: z.enum(['admin', 'client', 'partner', 'system']),
  at: instant,
  internal: z.boolean(),
});
const dependency = z.object({
  id: z.uuid(),
  title: z.string(),
  due: z.iso.date(),
  status: z.enum(['pending', 'received', 'cancelled']),
  receivedAt: instantOrNull,
});
const schedule = z.object({
  id: z.uuid(),
  number: z.number().int(),
  status: z.string(),
  dueAt: instantOrNull,
  note,
  resolution: note,
  target: note,
});
const lifecycle = z.object({
  id: z.uuid(),
  action: z.string(),
  scope: z.string(),
  at: instant,
  resume: z.iso.date().nullable(),
  note,
});
const deliveryHistory = z.object({
  id: z.string(),
  event: z.enum(['status', 'deadline', 'correction', 'correction-approval']),
  status: z.string().nullable(),
  at: instant,
  note,
  previousDue: instantOrNull,
  nextDue: instantOrNull,
  score: z.number().int().nullable(),
});
const journal = z.discriminatedUnion('section', [
  summary.extend({ section: z.literal('tasks'), rows: z.array(task) }),
  summary.extend({ section: z.literal('conversation'), rows: z.array(message) }),
  summary.extend({ section: z.literal('dependencies'), rows: z.array(dependency) }),
  summary.extend({ section: z.literal('schedule'), rows: z.array(schedule) }),
  summary.extend({ section: z.literal('lifecycle'), rows: z.array(lifecycle) }),
  summary.extend({ section: z.literal('delivery-history'), rows: z.array(deliveryHistory) }),
]);
export type ProjectJournalEntry = z.infer<typeof journal>;
export type ProjectJournalSection = ProjectJournalEntry['section'];
export type ProjectTask = z.infer<typeof task>;
export const isTaskClosed = (task: ProjectTask) =>
  ['approved', 'done', 'cancelled'].includes(task.status);
export type ProjectAssignee = z.infer<typeof assignee>;
export type ProjectJournalScope = z.infer<typeof projectScope> & { actor?: string };

const taskIdentity = z.object({ task: z.uuid(), expected: instant });
const collaboration = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('task-save'),
    fields: z.object({
      task: z.uuid().nullable(),
      expected: instantOrNull,
      title: z.string().trim().min(2).max(200),
      note: z.string().trim().max(8000),
      due: z.iso.datetime({ local: true }).nullable(),
      complexity: deliveryComplexity.nullable(),
      visible: z.boolean(),
      assignee: z.uuid().nullable(),
      estimatedMinutes: z.number().int().min(0).max(100000),
    }),
  }),
  z.object({
    action: z.literal('task-status'),
    fields: taskIdentity.extend({ status: taskAdminStatus }),
  }),
  z.object({ action: z.literal('task-approve'), fields: taskIdentity }),
  z.object({
    action: z.literal('task-adjust'),
    fields: taskIdentity.extend({ note: z.string().trim().min(10).max(4000) }),
  }),
  z.object({
    action: z.literal('message'),
    fields: z.object({
      task: z.uuid().nullable(),
      note: z.string().trim().min(1).max(5000),
      internal: z.boolean(),
    }),
  }),
  z.object({
    action: z.literal('dependency-create'),
    fields: z.object({ title: z.string().trim().min(1).max(200), day: z.iso.date() }),
  }),
  z.object({
    action: z.literal('dependency-state'),
    fields: z.object({ item: z.uuid(), status: z.enum(['received', 'cancelled']) }),
  }),
  z.object({
    action: z.literal('deadline'),
    fields: z.object({
      expected: instant,
      due: z.iso.datetime({ local: true }),
      cause: deadlineCause,
      note: z.string().trim().min(1).max(1000),
    }),
  }),
]);
export type CollaborationAction = z.infer<typeof collaboration>;

export function createProjectJournal(client: WorkspaceClient, canWrite: boolean) {
  return {
    async read(
      scope: ProjectJournalScope,
      section: ProjectJournalSection,
      page: number,
      delivery: string | null,
      taskId: string | null,
      signal: AbortSignal,
    ) {
      const { company, project } = projectScope.parse(scope);
      const { data, error } = await client
        .rpc('v2_read_pilot_project_journal', {
          p_company_id: company,
          p_project_id: project,
          p_section: section,
          p_page: page,
          p_delivery_id: delivery,
          p_task_id: taskId,
        })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível carregar o detalhe do projeto.');
      const result = journal.nullable().parse(data);
      if (
        result &&
        (result.companyId !== company ||
          result.projectId !== project ||
          result.section !== section ||
          result.deliveryId !== delivery)
      )
        throw new Error('O detalhe retornado pertence a outra seleção.');
      return result;
    },
    operate: canWrite
      ? async (
          scope: ProjectJournalScope,
          delivery: string,
          requestId: string,
          input: CollaborationAction,
        ) => {
          const { company, project } = projectScope.parse(scope);
          const command = collaboration.safeParse(input);
          if (!command.success) throw new Error('Revise os campos antes de salvar.');
          const { data, error } = await client.rpc('v2_pilot_delivery_collaboration', {
            p_company_id: company,
            p_project_id: project,
            p_delivery_id: z.uuid().parse(delivery),
            p_request_id: z.uuid().parse(requestId),
            p_action: command.data.action,
            p_fields: command.data.fields,
          });
          if (error?.code === '40001')
            throw new Error('O registro mudou. Confira a versão atual e tente novamente.');
          if (error?.code === '42501') throw new Error('Operação indisponível para este acesso.');
          if (error?.code === '22023')
            throw new Error('Revise os dados, o prazo ou a situação do item.');
          if (error) throw new Error('Não foi possível concluir a operação do entregável.');
          return z.uuid().parse(data);
        }
      : null,
  };
}
export type ProjectJournal = ReturnType<typeof createProjectJournal>;
