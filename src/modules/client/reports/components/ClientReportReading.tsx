import { useEffect, useRef } from 'react';
import type { z } from 'zod';
import type { catalog } from '../../../../api/shared/workspace/schemas';
import { Button } from '../../../../components/ds/button/Button';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';
import { formatCalendarDate, formatServerInstant } from '../../../../lib/dates';
import { ReportPublicationActions } from '../../../../components/workspace/CatalogActions';
import { ReportAcknowledgment } from '../../../../components/reports/ReportPrivacyActions';
import {
  ReportCurationSections,
  ReportIndicators,
  ReportSources,
} from '../../../../components/reports/ReportCuration';
import { WorkspacePagination } from '../../../../components/workspace/WorkspacePagination';

type ReportCatalog = z.infer<typeof catalog>;
type Props = {
  company: string;
  actor?: string;
  data: ReportCatalog;
  report?: string;
  showList: boolean;
  page: number;
  select: (id: string) => void;
  changePage: (page: number) => void;
  toggleList: (showList: boolean) => void;
};

export function ClientReportReading({
  company,
  actor,
  data,
  report,
  showList,
  page,
  select,
  changePage,
  toggleList,
}: Props) {
  const current = report ? data.entries.find((item) => item.id === report) : data.entries[0];
  const title = useRef<HTMLHeadingElement>(null);
  const requestedReport = useRef<string>();
  useEffect(() => {
    if (showList || !report || requestedReport.current !== report) return;
    requestedReport.current = undefined;
    if (document.activeElement === document.body) title.current?.focus();
  }, [report, showList]);
  return (
    <section aria-label="Leitura executiva" className="tw:grid tw:gap-4">
      <nav aria-label="Exibição dos relatórios" className="tw:flex tw:flex-wrap tw:gap-2">
        <Button
          variant={showList ? 'secondary' : 'primary'}
          aria-pressed={!showList}
          onClick={() => toggleList(false)}
        >
          Leitura
        </Button>
        <Button
          variant={showList ? 'primary' : 'secondary'}
          aria-pressed={showList}
          onClick={() => toggleList(true)}
        >
          Todos os relatórios
        </Button>
      </nav>
      {showList ? (
        <>
          {data.entries.length ? (
            <ul className="tw:m-0 tw:grid tw:list-none tw:gap-2 tw:p-0">
              {data.entries.map((item) => (
                <li
                  key={item.id}
                  className="tw:flex tw:min-w-0 tw:flex-wrap tw:items-center tw:justify-between tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-3 tw:wrap-anywhere"
                >
                  <div>
                    <strong>{item.title}</strong>
                    {item.day && <p>{formatCalendarDate(item.day)}</p>}
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      requestedReport.current = item.id;
                      select(item.id);
                    }}
                  >
                    Abrir relatório
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <FeedbackState kind="empty">Nenhum relatório nesta página.</FeedbackState>
          )}
          <WorkspacePagination total={data.total} page={page} change={changePage} />
        </>
      ) : current ? (
        <div className="tw:grid tw:items-start tw:gap-4 tw:wide:grid-cols-[minmax(0,1fr)_minmax(15rem,22%)]">
          <article
            aria-labelledby="executive-report-title"
            className="tw:min-w-0 tw:overflow-hidden tw:rounded-control tw:border tw:border-border-default tw:bg-panel"
          >
            <header className="tw:grid tw:gap-3 tw:border-b tw:border-border-default tw:p-5 tw:wide:p-8">
              <p className="tw:m-0 tw:text-caption tw:font-semibold tw:tracking-widest tw:text-brand">
                Leitura executiva
              </p>
              <h2
                ref={title}
                id="executive-report-title"
                tabIndex={-1}
                className="tw:m-0 tw:text-section tw:font-bold tw:wrap-anywhere"
              >
                {current.title}
              </h2>
              {current.day && (
                <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
                  Referência <time dateTime={current.day}>{formatCalendarDate(current.day)}</time>
                </p>
              )}
            </header>
            <div className="tw:grid tw:gap-5 tw:p-5 tw:wide:p-8">
              {current.summary && (
                <section aria-label="Resumo executivo">
                  <h3 className="tw:mt-0 tw:mb-2 tw:font-semibold tw:text-brand">
                    Resumo executivo
                  </h3>
                  <p className="tw:m-0 tw:max-w-prose tw:leading-note tw:wrap-anywhere tw:whitespace-pre-line">
                    {current.summary}
                  </p>
                </section>
              )}
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
            </div>
          </article>
          <aside aria-label="Sobre a leitura" className="tw:grid tw:gap-3">
            <div className="tw:grid tw:gap-3 tw:rounded-control tw:bg-brand tw:p-5 tw:text-panel">
              <h3 className="tw:m-0 tw:font-semibold">Sobre a leitura</h3>
              <dl className="tw:m-0 tw:grid tw:gap-3 tw:[&_dd]:m-0 tw:[&_dd]:wrap-anywhere tw:[&_dt]:text-caption">
                {current.reportVersion && (
                  <div>
                    <dt>Versão</dt>
                    <dd>{current.reportVersion}</dd>
                  </div>
                )}
                {current.protocol && (
                  <div>
                    <dt>Protocolo</dt>
                    <dd>{current.protocol}</dd>
                  </div>
                )}
                {current.instant && (
                  <div>
                    <dt>Disponível desde</dt>
                    <dd>{formatServerInstant(current.instant)}</dd>
                  </div>
                )}
              </dl>
            </div>
            {current.reportVersion ? (
              <ReportPublicationActions
                key={current.id}
                company={company}
                actor={actor}
                id={current.id}
                version={current.reportVersion}
                pdfReady={Boolean(current.reportPdfReady)}
                published
                admin={false}
                previouslyReleased={Boolean(current.reportPreviouslyReleased)}
                acknowledgmentAvailable={Boolean(current.acknowledgmentAvailable)}
                acknowledged={Boolean(current.reportAcknowledged)}
              />
            ) : current.acknowledgmentAvailable ? (
              <ReportAcknowledgment key={current.id} company={company} report={current.id} />
            ) : null}
          </aside>
        </div>
      ) : (
        <FeedbackState kind="empty">
          {report ? 'Relatório indisponível nesta página.' : 'Nenhum relatório disponível ainda.'}
        </FeedbackState>
      )}
    </section>
  );
}
