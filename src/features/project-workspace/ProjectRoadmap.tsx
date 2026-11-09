import type { ProjectDetail } from '../../api/modules/project-workspace/schemas';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { formatCalendarDate, formatServerInstant } from '../../lib/dates';
import { ProjectJournalPanel } from './ProjectJournalPanel';
import { workspaceLabel } from './workspace-labels';

type Props = {
  data: ProjectDetail;
  actor?: string;
  admin: boolean;
};

export function ProjectRoadmap({ data, actor, admin }: Props) {
  const { project, items } = data;
  const start = Date.parse(project.roadmap_start_date ?? '');
  const end = Date.parse(project.roadmap_end_date ?? '');
  const hasPeriod = Number.isFinite(start) && end > start;
  const scope = { company: data.companyId, actor, project: project.id };

  return (
    <section aria-labelledby="project-roadmap-title" className="tw:grid tw:min-w-0 tw:gap-3">
      <header>
        <h3 id="project-roadmap-title" className="tw:text-section tw:font-semibold">
          Prazos das entregas
        </h3>
        <p>Abra um marco para consultar os detalhes da entrega.</p>
      </header>
      {hasPeriod && (
        <div className="tw:flex tw:justify-between tw:gap-3 tw:text-caption tw:text-muted-copy">
          <span>Início · {formatCalendarDate(project.roadmap_start_date ?? '')}</span>
          <span>Conclusão · {formatCalendarDate(project.roadmap_end_date ?? '')}</span>
        </div>
      )}
      {items.rows.length === 0 && (
        <FeedbackState kind="empty">Nenhuma entrega nesta página do cronograma.</FeedbackState>
      )}
      {items.rows.length > 0 && (
        <ol
          aria-label="Marcos do cronograma"
          className="tw:m-0 tw:grid tw:list-none tw:gap-2 tw:p-0"
        >
          {items.rows.map((row) => {
            const due = Date.parse(row.due_at ?? '');
            const position = Math.max(0, Math.min(100, ((due - start) / (end - start)) * 100));
            const milestone = (
              <span className="tw:inline-grid tw:w-full tw:min-w-0 tw:gap-1">
                <strong className="tw:wrap-anywhere">{row.name}</strong>
                <span>
                  {workspaceLabel(row.status)} · {workspaceLabel(row.execution_status)}
                </span>
                <span>{row.due_at ? formatServerInstant(row.due_at) : 'Sem prazo definido'}</span>
                {hasPeriod && Number.isFinite(due) && (
                  <span
                    aria-hidden="true"
                    className="tw:relative tw:mx-2 tw:my-2 tw:block tw:h-px tw:bg-border-default"
                  >
                    <span
                      className="tw:absolute tw:top-1/2 tw:size-3 tw:-translate-1/2 tw:rounded-full tw:bg-brand"
                      style={{ left: `${position}%` }}
                    />
                  </span>
                )}
              </span>
            );
            return (
              <li
                key={row.id}
                className="tw:rounded-control tw:border tw:border-border-default tw:p-3"
              >
                <ProjectJournalPanel
                  scope={scope}
                  admin={admin}
                  delivery={row}
                  summary={milestone}
                />
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
