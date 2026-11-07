import { ActionForm } from './ActionForm';
import { type JournalSubmit } from './useJournalAction';
import {
  deliveryComplexity,
  taskAdminStatus,
  isTaskClosed,
  type ProjectTask,
  type ProjectAssignee,
} from '../../api/modules/project-workspace/project-journal';
import { Field } from '../../components/ds/field/Field';
import { Checkbox } from '../../components/ds/checkbox/Checkbox';
import { toBrasiliaDateTimeInput } from '../../lib/dates';
import { workspaceLabel } from './workspace-labels';

const value = (data: FormData, key: string) => String(data.get(key) ?? '');

export function TaskEditor({
  submit,
  task,
  assignees,
}: {
  submit: JournalSubmit;
  task?: ProjectTask;
  assignees: ProjectAssignee[];
}) {
  return (
    <ActionForm
      label={task ? 'Salvar subtarefa' : 'Criar subtarefa'}
      submit={(fields, id) =>
        submit(
          {
            action: 'task-save',
            fields: {
              task: task?.id ?? null,
              expected: task?.updatedAt ?? null,
              title: value(fields, 'title'),
              note: value(fields, 'note'),
              due: value(fields, 'due') || null,
              complexity: deliveryComplexity.nullable().parse(value(fields, 'complexity') || null),
              visible: fields.get('visible') === 'on',
              assignee: value(fields, 'assignee') || null,
              estimatedMinutes: Number(fields.get('estimate')),
            },
          },
          id,
        )
      }
    >
      {(prefix) => (
        <>
          <Field id={prefix + 'title'} label="Título da subtarefa">
            <input
              id={prefix + 'title'}
              name="title"
              required
              minLength={2}
              maxLength={200}
              defaultValue={task?.title}
            />
          </Field>
          <Field id={prefix + 'note'} label="Descrição">
            <textarea
              id={prefix + 'note'}
              name="note"
              maxLength={8000}
              defaultValue={task?.description ?? ''}
            />
          </Field>
          <Field id={prefix + 'due'} label="Prazo da subtarefa em Brasília">
            <input
              id={prefix + 'due'}
              name="due"
              type="datetime-local"
              defaultValue={toBrasiliaDateTimeInput(task?.due ?? null)}
            />
          </Field>
          <Field id={prefix + 'complexity'} label="Complexidade">
            <select
              id={prefix + 'complexity'}
              name="complexity"
              defaultValue={task?.complexity ?? ''}
            >
              <option value="">Não definida</option>
              {deliveryComplexity.options.map((level) => (
                <option key={level}>{level}</option>
              ))}
            </select>
          </Field>
          <Field id={prefix + 'assignee'} label="Responsável CALI">
            <select id={prefix + 'assignee'} name="assignee" defaultValue={task?.assignee ?? ''}>
              <option value="">Sem responsável</option>
              {task?.assignee && !assignees.some((member) => member.id === task.assignee) && (
                <option value={task.assignee}>Responsável anterior indisponível</option>
              )}
              {assignees.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id={prefix + 'estimate'} label="Estimativa em minutos">
            <input
              id={prefix + 'estimate'}
              type="number"
              name="estimate"
              min={0}
              max={100000}
              defaultValue={task?.estimatedMinutes ?? 0}
            />
          </Field>
          <Checkbox name="visible" defaultChecked={task?.visible}>
            Mostrar esta subtarefa ao Cliente
          </Checkbox>
        </>
      )}
    </ActionForm>
  );
}

export function TaskActions({
  task,
  admin,
  submit,
  assignees,
}: {
  task: ProjectTask;
  admin: boolean;
  submit: JournalSubmit | null;
  assignees: ProjectAssignee[];
}) {
  if (!submit || isTaskClosed(task)) return null;
  const identity = { task: task.id, expected: task.updatedAt };
  if (admin)
    return (
      <div className="tw:grid tw:gap-3">
        {task.status !== 'client_review' && (
          <details>
            <summary>Editar subtarefa</summary>
            <TaskEditor key={task.updatedAt} task={task} submit={submit} assignees={assignees} />
          </details>
        )}
        <ActionForm
          label="Atualizar subtarefa"
          submit={(fields, id) =>
            submit(
              {
                action: 'task-status',
                fields: { ...identity, status: taskAdminStatus.parse(fields.get('status')) },
              },
              id,
            )
          }
        >
          {(prefix) => (
            <Field id={prefix + 'status'} label="Situação da subtarefa">
              <select id={prefix + 'status'} name="status" required defaultValue="">
                <option value="" disabled>
                  Selecione
                </option>
                {taskAdminStatus.options
                  .filter(
                    (status) =>
                      status !== task.status && (task.visible || status !== 'client_review'),
                  )
                  .map((status) => (
                    <option key={status} value={status}>
                      {workspaceLabel(status)}
                    </option>
                  ))}
              </select>
            </Field>
          )}
        </ActionForm>
      </div>
    );
  if (task.status !== 'client_review') return null;
  return (
    <div className="tw:grid tw:gap-3">
      <ActionForm
        label="Aprovar subtarefa"
        submit={(_, id) => submit({ action: 'task-approve', fields: identity }, id)}
      />
      {task.adjustments < 2 && (
        <ActionForm
          label="Pedir ajuste da subtarefa"
          submit={(fields, id) =>
            submit(
              { action: 'task-adjust', fields: { ...identity, note: value(fields, 'note') } },
              id,
            )
          }
        >
          {(prefix) => (
            <Field id={prefix + 'note'} label="Descreva o ajuste da subtarefa">
              <textarea id={prefix + 'note'} name="note" required minLength={10} maxLength={4000} />
            </Field>
          )}
        </ActionForm>
      )}
    </div>
  );
}
