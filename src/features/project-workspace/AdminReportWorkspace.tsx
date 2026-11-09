import type { z } from 'zod';
import type { catalog } from '../../api/modules/project-workspace/schemas';
import { Button } from '../../components/ds/button/Button';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { formatCalendarDate } from '../../lib/dates';
import { ReportDraftActions, ReportPublicationActions } from './CatalogActions';
import { ReportCurationSections, ReportIndicators, ReportSources } from './ReportCuration';
import { WorkspacePagination } from './WorkspacePagination';
import { workspaceLabel } from './workspace-labels';

type ReportCatalog = z.infer<typeof catalog>;
type Props = {
  company: string;
  actor?: string;
  data: ReportCatalog;
  page: number;
  report?: string;
  select: (id: string) => void;
  changePage: (page: number) => void;
};

const stages = [
  { status: 'draft', label: 'Rascunho' },
  { status: 'review', label: 'Revisão interna' },
  { status: 'approved', label: 'Aprovado' },
  { status: 'published', label: 'Liberado ao Cliente' },
] as const;

export function AdminReportWorkspace({
  company,
  actor,
  data,
  page,
  report,
  select,
  changePage,
}: Props) {
  const current = data.entries.find((entry) => entry.id === report) ?? data.entries[0];

  if (!current) {
    return (
      <>
        <FeedbackState kind="empty">Nenhum relatório nesta página.</FeedbackState>
        <WorkspacePagination total={data.total} page={page} change={changePage} />
      </>
    );
  }

  const stage = current.status === 'sent' ? 'published' : current.status;

  return (
    <section
      aria-label="Edição e histórico de relatórios"
      className="tw:grid tw:items-start tw:gap-4 tw:wrap-anywhere tw:wide:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
    >
      <article
        key={current.id}
        className="tw:grid tw:min-w-0 tw:gap-4 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4"
      >
        <header className="tw:border-b tw:border-border-default tw:pb-4">
          <p className="tw:text-caption tw:text-muted-copy">
            {[
              current.protocol,
              current.day && formatCalendarDate(current.day),
              current.status && workspaceLabel(current.status),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <h2 className="tw:text-section tw:font-semibold">{current.title}</h2>
        </header>
        {stages.some(({ status }) => status === stage) && (
          <ol
            aria-label="Etapa do fechamento"
            className="tw:grid tw:grid-cols-2 tw:gap-2 tw:wide:grid-cols-4"
          >
            {stages.map(({ status, label }) => (
              <li
                key={status}
                aria-current={status === stage ? 'step' : undefined}
                className={
                  status === stage
                    ? 'tw:rounded-control tw:border tw:border-brand tw:p-2 tw:text-caption tw:font-semibold tw:text-brand'
                    : 'tw:rounded-control tw:border tw:border-border-default tw:p-2 tw:text-caption tw:text-muted-copy'
                }
              >
                {label}
              </li>
            ))}
          </ol>
        )}
        {current.summary && <p className="tw:whitespace-pre-line">{current.summary}</p>}
        {current.reportSourceCounts && <ReportSources counts={current.reportSourceCounts} />}
        {current.reportVersion && current.reportCuration && (
          <ReportCurationSections sections={current.reportCuration} />
        )}
        {current.reportVersion && current.reportMetrics && (
          <ReportIndicators metrics={current.reportMetrics} />
        )}
        {current.reportVersion && current.reportClientSourceCounts && (
          <ReportSources
            counts={current.reportClientSourceCounts}
            title="Conteúdo visível no Workspace"
          />
        )}
        {current.reportUpdatedAt && (
          <ReportDraftActions
            company={company}
            actor={actor}
            id={current.id}
            status={current.status}
            expected={current.reportUpdatedAt}
            summary={current.summary}
            curation={current.reportCuration}
            released={current.status === 'published' && Boolean(current.reportVersion)}
          />
        )}
        {current.reportVersion && (
          <ReportPublicationActions
            company={company}
            actor={actor}
            id={current.id}
            version={current.reportVersion}
            pdfReady={Boolean(current.reportPdfReady)}
            published={current.status === 'published'}
            admin
            previouslyReleased={Boolean(current.reportPreviouslyReleased)}
            acknowledgmentAvailable={Boolean(current.acknowledgmentAvailable)}
            acknowledged={Boolean(current.reportAcknowledged)}
          />
        )}
      </article>
      <aside
        aria-label="Histórico de relatórios"
        className="tw:grid tw:min-w-0 tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4"
      >
        <h2 className="tw:text-section tw:font-semibold">Histórico de relatórios</h2>
        <ul className="tw:grid tw:gap-2">
          {data.entries.map((entry) => (
            <li key={entry.id}>
              <Button
                variant="secondary"
                className="tw:max-w-full"
                aria-pressed={current.id === entry.id}
                onClick={() => select(entry.id)}
              >
                {entry.title}
              </Button>
            </li>
          ))}
        </ul>
        <WorkspacePagination total={data.total} page={page} change={changePage} />
      </aside>
    </section>
  );
}
