import { useState, type ReactNode } from 'react';
import { HourLink } from './HourLink';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import {
  deadlineCause,
  isTaskClosed,
  type ProjectJournalScope,
  type ProjectJournalSection,
  type ProjectJournalEntry,
} from '../../api/modules/project-workspace/project-journal';
import { type ProjectDetail } from '../../api/modules/project-workspace/schemas';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { formatServerInstant, formatCalendarDate, toBrasiliaDateTimeInput } from '../../lib/dates';
import { ActionForm } from './ActionForm';
import { Dependencies, Discussion } from './DeliveryDiscussion';
import { TaskActions, TaskEditor } from './DeliveryTasks';
import { useJournalAction, type JournalSubmit } from './useJournalAction';
import { workspaceLabel } from './workspace-labels';
import { WorkspacePagination } from './WorkspacePagination';

const sectionLabels = {
  schedule: 'Revisões do cronograma',
  lifecycle: 'Movimentos do projeto',
  tasks: 'Subtarefas',
  conversation: 'Conversa',
  dependencies: 'Dependências',
  'delivery-history': 'Histórico do entregável',
} satisfies Record<ProjectJournalSection, string>;
const projectSections = ['schedule', 'lifecycle'] as const;
const deliverySections = ['tasks', 'conversation', 'dependencies', 'delivery-history'] as const;
const causeLabels = {
  client_dependency: 'Retorno do Cliente',
  scope: 'Escopo',
  internal: 'Organização interna',
  other: 'Outro motivo',
} as const;
type Delivery = ProjectDetail['items']['rows'][number];

type JournalProps = {
  scope: ProjectJournalScope;
  admin: boolean;
  section: ProjectJournalSection;
  delivery?: Delivery;
  task?: string;
  submit: JournalSubmit | null;
};

function JournalContent({ scope, admin, section, delivery, task, submit }: JournalProps) {
  const { projectJournal } = useRouteContext({ from: '__root__' });
  const [page, setPage] = useState(1);
  const result = useQuery({
    queryKey: [
      'project-journal',
      scope.actor,
      scope.company,
      scope.project,
      delivery?.id,
      section,
      task,
      page,
    ],
    queryFn: projectJournal
      ? ({ signal }) =>
          projectJournal.read(scope, section, page, delivery?.id ?? null, task ?? null, signal)
      : skipToken,
  });
  if (result.isPending)
    return (
      <FeedbackState kind="loading">
        Carregando {sectionLabels[section].toLocaleLowerCase('pt-BR')}…
      </FeedbackState>
    );
  if (result.isError)
    return (
      <FeedbackState kind="error" onRetry={() => void result.refetch()}>
        Não foi possível carregar o detalhe.
      </FeedbackState>
    );
  const entry = result.data;
  if (!entry) return <FeedbackState kind="empty">Detalhe indisponível.</FeedbackState>;
  return (
    <div className="tw:grid tw:gap-3">
      <JournalRows
        entry={entry}
        scope={scope}
        admin={admin}
        delivery={delivery}
        task={task}
        submit={submit}
      />
      <WorkspacePagination total={entry.total} page={page} change={setPage} />
    </div>
  );
}

function JournalRows({
  entry,
  scope,
  admin,
  delivery,
  task,
  submit,
}: Omit<JournalProps, 'section'> & { entry: ProjectJournalEntry }) {
  switch (entry.section) {
    case 'conversation':
      return <Discussion rows={entry.rows} admin={admin} task={task ?? null} submit={submit} />;
    case 'dependencies':
      return <Dependencies rows={entry.rows} submit={admin ? submit : null} />;
    case 'tasks':
      return (
        <div className="tw:grid tw:gap-3">
          {admin && submit && (
            <details>
              <summary>Adicionar subtarefa</summary>
              <TaskEditor submit={submit} assignees={entry.assignees} />
            </details>
          )}
          {entry.rows.length === 0 && <p>Nenhuma subtarefa disponível.</p>}
          {entry.rows.map((row) => (
            <section
              key={row.id}
              className="tw:grid tw:gap-2 tw:border-b tw:border-border-default tw:pb-3"
            >
              <h4 className="tw:font-semibold">{row.title}</h4>
              {row.description && <p>{row.description}</p>}
              <p>
                {workspaceLabel(row.status)}
                {row.due && ` · Prazo ${formatServerInstant(row.due)}`}
                {row.complexity && ` · ${row.complexity}`}
              </p>
              {admin && (
                <p>
                  {row.visible ? 'Visível ao Cliente' : 'Somente CALI'}
                  {row.assignee &&
                    ` · ${entry.assignees.find((member) => member.id === row.assignee)?.name ?? 'Responsável indisponível'}`}
                </p>
              )}
              <TaskActions task={row} admin={admin} submit={submit} assignees={entry.assignees} />
              {admin && submit && delivery && !isTaskClosed(row) && (
                <HourLink company={scope.company} delivery={delivery.id} task={row.id} />
              )}
              <TaskDiscussion
                scope={scope}
                admin={admin}
                delivery={delivery}
                task={row.id}
                submit={isTaskClosed(row) ? null : submit}
              />
            </section>
          ))}
        </div>
      );
    case 'schedule':
      return entry.rows.length ? (
        <ol className="tw:grid tw:gap-2">
          {entry.rows.map((row) => (
            <li key={row.id}>
              <strong>
                Revisão {row.number} · {workspaceLabel(row.status)}
              </strong>
              {row.dueAt && <p>Prazo {formatServerInstant(row.dueAt)}</p>}
              {row.target && <p>Alvo: {row.target}</p>}
              {row.note && <p>{row.note}</p>}
              {row.resolution && <p>Decisão da CALI: {row.resolution}</p>}
            </li>
          ))}
        </ol>
      ) : (
        <p>Nenhuma revisão registrada.</p>
      );
    case 'lifecycle':
      return entry.rows.length ? (
        <ol className="tw:grid tw:gap-2">
          {entry.rows.map((row) => (
            <li key={row.id}>
              <strong>
                {workspaceLabel(row.action)} · {row.scope}
              </strong>
              <p>{formatServerInstant(row.at)}</p>
              {row.note && <p>{row.note}</p>}
              {row.resume && <p>Retomada planejada {formatCalendarDate(row.resume)}</p>}
            </li>
          ))}
        </ol>
      ) : (
        <p>Nenhum movimento registrado.</p>
      );
    case 'delivery-history':
      return (
        <div className="tw:grid tw:gap-3">
          {entry.rows.length ? (
            <ol className="tw:grid tw:gap-2">
              {entry.rows.map((row) => (
                <li key={row.id}>
                  <strong>
                    {historyTitle(row)} · {formatServerInstant(row.at)}
                  </strong>
                  {row.nextDue && (
                    <p>
                      {row.previousDue ? `${formatServerInstant(row.previousDue)} para ` : ''}
                      {formatServerInstant(row.nextDue)}
                    </p>
                  )}
                  {row.note && <p>{row.note}</p>}
                  {row.score && <p>Avaliação: {row.score}/5</p>}
                </li>
              ))}
            </ol>
          ) : (
            <p>Nenhum movimento registrado.</p>
          )}
          {admin && submit && delivery?.updated_at && (
            <DeadlineEditor expected={delivery.updated_at} due={delivery.due_at} submit={submit} />
          )}
        </div>
      );
  }
}

function historyTitle(
  row: Extract<ProjectJournalEntry, { section: 'delivery-history' }>['rows'][number],
) {
  switch (row.event) {
    case 'status':
      return workspaceLabel(row.status ?? '');
    case 'deadline':
      return 'Prazo revisado';
    case 'correction':
      return 'Reaberto para correção';
    case 'correction-approval':
      return 'Correção aprovada';
  }
}

function DeadlineEditor({
  expected,
  due,
  submit,
}: {
  expected: string;
  due: string | null;
  submit: JournalSubmit;
}) {
  return (
    <ActionForm
      key={expected}
      label="Revisar prazo do entregável"
      submit={(fields, id) =>
        submit(
          {
            action: 'deadline',
            fields: {
              expected,
              due: String(fields.get('due') ?? ''),
              cause: deadlineCause.parse(fields.get('cause')),
              note: String(fields.get('note') ?? ''),
            },
          },
          id,
        )
      }
    >
      {(prefix) => (
        <>
          <Field id={prefix + 'due'} label="Novo prazo em Brasília">
            <input
              id={prefix + 'due'}
              name="due"
              type="datetime-local"
              defaultValue={toBrasiliaDateTimeInput(due)}
              required
            />
          </Field>
          <Field id={prefix + 'cause'} label="Motivo da revisão">
            <select id={prefix + 'cause'} name="cause" required defaultValue="">
              <option value="" disabled>
                Selecione
              </option>
              {deadlineCause.options.map((cause) => (
                <option key={cause} value={cause}>
                  {causeLabels[cause]}
                </option>
              ))}
            </select>
          </Field>
          <Field id={prefix + 'note'} label="Justificativa">
            <textarea id={prefix + 'note'} name="note" maxLength={1000} required />
          </Field>
        </>
      )}
    </ActionForm>
  );
}

function TaskDiscussion(props: Omit<JournalProps, 'section'>) {
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Conversa da subtarefa</summary>
      {open && <JournalContent {...props} section="conversation" />}
    </details>
  );
}

export function ProjectJournalPanel({
  scope,
  admin,
  delivery,
  canOperate = false,
  summary,
  standalone = false,
}: {
  scope: ProjectJournalScope;
  admin: boolean;
  delivery?: Delivery;
  canOperate?: boolean;
  summary?: ReactNode;
  standalone?: boolean;
}) {
  const { projectJournal } = useRouteContext({ from: '__root__' });
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<ProjectJournalSection>(delivery ? 'tasks' : 'schedule');
  const submit = useJournalAction(
    scope,
    delivery?.id ?? '',
    Boolean(delivery && canOperate && !['approved', 'cancelled'].includes(delivery.status)),
  );
  if (!projectJournal) return summary ?? null;
  const sections = delivery ? deliverySections : projectSections;
  const content = (open || standalone) && (
    <div className="tw:my-3 tw:grid tw:gap-3">
      <div className="tw:flex tw:flex-wrap tw:gap-2" aria-label="Seções do detalhe">
        {sections.map((key) => (
          <Button
            key={key}
            variant="secondary"
            aria-pressed={key === section}
            onClick={() => setSection(key)}
          >
            {sectionLabels[key]}
          </Button>
        ))}
      </div>
      <JournalContent
        key={section}
        scope={scope}
        admin={admin}
        delivery={delivery}
        section={section}
        submit={submit}
      />
    </div>
  );
  if (standalone) {
    return (
      <section aria-label="Histórico do projeto">
        <h3 className="tw:text-section tw:font-semibold">Histórico do projeto</h3>
        {content}
      </section>
    );
  }
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        {summary ?? (delivery ? 'Detalhes de ' + delivery.name : 'Histórico do projeto')}
      </summary>
      {content}
    </details>
  );
}
