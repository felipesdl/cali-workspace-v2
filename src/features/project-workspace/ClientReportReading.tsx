import type { z } from 'zod';
import oakMark from '../../assets/brand/cali-oak-mark-light.svg';
import type { catalog } from '../../api/modules/project-workspace/schemas';
import { Button } from '../../components/ds/button/Button';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { formatCalendarDate, formatServerInstant } from '../../lib/dates';
import { ReportPublicationActions } from './CatalogActions';
import { ReportAcknowledgment } from './ReportPrivacyActions';
import { ReportCurationSections, ReportIndicators, ReportSources } from './ReportCuration';
import { WorkspacePagination } from './WorkspacePagination';

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
                  className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-3"
                >
                  <div>
                    <strong>{item.title}</strong>
                    {item.day && <p>{formatCalendarDate(item.day)}</p>}
                  </div>
                  <Button variant="secondary" onClick={() => select(item.id)}>
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
        <div className="tw:grid tw:items-start tw:gap-4 tw:wide:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <article
            aria-labelledby="executive-report-title"
            className="tw:min-w-0 tw:overflow-hidden tw:rounded-control tw:border tw:border-border-default tw:bg-panel"
          >
            <header className="tw:grid tw:gap-3 tw:border-b-4 tw:border-gold tw:bg-brand tw:p-5 tw:text-panel tw:wide:p-8">
              <div className="tw:flex tw:items-center tw:gap-2">
                <img src={oakMark} alt="" width={24} height={24} />
                <span className="tw:text-caption tw:font-semibold tw:tracking-widest">
                  CALI WORKSPACE
                </span>
              </div>
              <p className="tw:m-0 tw:text-caption">Relatório executivo</p>
              <h2
                id="executive-report-title"
                className="tw:m-0 tw:text-section tw:font-semibold tw:wrap-anywhere"
              >
                {current.title}
              </h2>
              {current.day && (
                <p className="tw:m-0 tw:text-caption">
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
          <aside
            aria-label="Sobre a leitura"
            className="tw:grid tw:gap-3 tw:rounded-control tw:border tw:border-l-4 tw:border-border-default tw:border-l-brand tw:bg-panel tw:p-4"
          >
            <h3 className="tw:m-0 tw:font-semibold tw:text-brand">Sobre a leitura</h3>
            <dl className="tw:m-0 tw:grid tw:gap-3 tw:[&_dd]:m-0 tw:[&_dd]:wrap-anywhere tw:[&_dt]:text-caption tw:[&_dt]:text-muted-copy">
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
