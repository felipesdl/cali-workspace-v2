import type { ProjectDetail } from '../../api/shared/workspace/schemas';
import { formatCalendarDate, formatServerInstant } from '../../lib/dates';
import { workspaceLabel } from '../workspace/workspace-labels';

export function ProjectOverview({ project, review }: Pick<ProjectDetail, 'project' | 'review'>) {
  const { roadmap_start_date: start, roadmap_end_date: end } = project;
  return (
    <header className="tw:grid tw:min-w-0 tw:gap-4 tw:rounded-control tw:border tw:border-t-[3px] tw:border-border-default tw:border-t-brand tw:bg-panel tw:p-5 tw:wrap-anywhere tw:wide:p-6">
      <div className="tw:flex tw:min-w-0 tw:flex-wrap tw:items-start tw:justify-between tw:gap-4">
        <div className="tw:grid tw:min-w-0 tw:gap-2">
          {project.protocol && (
            <p className="tw:m-0 tw:text-caption tw:font-semibold tw:tracking-wide tw:text-muted-copy">
              {project.protocol}
            </p>
          )}
          <h2 className="tw:m-0 tw:text-[clamp(1.25rem,2.3vw,1.6rem)] tw:font-bold tw:tracking-tight tw:wrap-anywhere">
            {project.name}
          </h2>
          {project.description && (
            <p className="tw:m-0 tw:max-w-prose tw:whitespace-pre-line tw:text-muted-copy">
              {project.description}
            </p>
          )}
        </div>
        <div
          role="group"
          className="tw:flex tw:flex-wrap tw:gap-2"
          aria-label="Situação do projeto"
        >
          <span className="tw:rounded-full tw:border tw:border-border-default tw:bg-ivory tw:px-3 tw:py-1 tw:text-caption tw:font-semibold tw:text-brand">
            {workspaceLabel(project.planning_status)}
          </span>
          <span className="tw:rounded-full tw:border tw:border-border-default tw:px-3 tw:py-1 tw:text-caption tw:text-muted-copy">
            {workspaceLabel(project.execution_status)}
          </span>
        </div>
      </div>
      <dl className="tw:m-0 tw:grid tw:min-w-0 tw:grid-cols-2 tw:gap-3 tw:border-t tw:border-border-default tw:pt-4 tw:text-caption tw:wide:grid-cols-4">
        {start && (
          <div className="tw:grid tw:gap-1">
            <dt className="tw:font-semibold tw:text-muted-copy">Início</dt>
            <dd className="tw:m-0 tw:font-semibold">{formatCalendarDate(start)}</dd>
          </div>
        )}
        {end && (
          <div className="tw:grid tw:gap-1">
            <dt className="tw:font-semibold tw:text-muted-copy">Meta</dt>
            <dd className="tw:m-0 tw:font-semibold">{formatCalendarDate(end)}</dd>
          </div>
        )}
        {review && (
          <div className="tw:grid tw:gap-1 tw:wrap-anywhere">
            <dt className="tw:font-semibold tw:text-muted-copy">Revisão {review.number}</dt>
            <dd className="tw:m-0 tw:font-semibold">
              {workspaceLabel(review.status)}
              {review.dueAt && <> · {formatServerInstant(review.dueAt)} (Brasília)</>}
              {review.pastDue && <> · Prazo vencido</>}
            </dd>
          </div>
        )}
      </dl>
    </header>
  );
}
