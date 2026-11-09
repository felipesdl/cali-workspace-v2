import type { ProjectDetail } from '../../api/modules/project-workspace/schemas';
import { formatCalendarDate, formatServerInstant } from '../../lib/dates';
import { workspaceLabel } from './workspace-labels';

export function ProjectOverview({ project, review }: Pick<ProjectDetail, 'project' | 'review'>) {
  const { roadmap_start_date: start, roadmap_end_date: end } = project;
  return (
    <header className="tw:grid tw:gap-3 tw:rounded-control tw:bg-brand tw:p-5 tw:text-panel tw:wide:p-6">
      {project.protocol && (
        <p className="tw:m-0 tw:text-caption tw:tracking-wide">{project.protocol}</p>
      )}
      <h2 className="tw:m-0 tw:text-section tw:font-semibold tw:wrap-anywhere">{project.name}</h2>
      {project.description && (
        <p className="tw:m-0 tw:max-w-prose tw:wrap-anywhere tw:whitespace-pre-line">
          {project.description}
        </p>
      )}
      <dl className="tw:m-0 tw:flex tw:flex-wrap tw:gap-x-6 tw:gap-y-3 tw:border-t tw:border-panel/30 tw:pt-3 tw:text-caption">
        <div>
          <dt className="tw:font-semibold">Situação</dt>
          <dd className="tw:m-0">
            {workspaceLabel(project.planning_status)} · {workspaceLabel(project.execution_status)}
          </dd>
        </div>
        {start && (
          <div>
            <dt className="tw:font-semibold">Início</dt>
            <dd className="tw:m-0">{formatCalendarDate(start)}</dd>
          </div>
        )}
        {end && (
          <div>
            <dt className="tw:font-semibold">Fim</dt>
            <dd className="tw:m-0">{formatCalendarDate(end)}</dd>
          </div>
        )}
        {review && (
          <div>
            <dt className="tw:font-semibold">Revisão {review.number}</dt>
            <dd className="tw:m-0">
              {workspaceLabel(review.status)}
              {review.dueAt && <> · Prazo {formatServerInstant(review.dueAt)} (Brasília)</>}
              {review.pastDue && <> · Prazo de resposta vencido</>}
            </dd>
          </div>
        )}
      </dl>
    </header>
  );
}
