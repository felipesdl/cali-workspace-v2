import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { clientAccountPaths } from '../../../../app/navigation';
import { type CompanyAccount } from '../../../../api/admin/companies/schemas';
import {
  type CatalogModule,
  type catalog,
  type hours,
  type projectDetail,
  type projectList,
} from '../../../../api/shared/workspace/schemas';
import { workspaceSearch } from '../../../../api/shared/workspace/schemas';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';
import { Minutes } from '../../../../components/hours/Minutes';
import { OpenRecord } from '../../../../components/records/RecordActions';
import { companyStatusLabels } from '../../../../components/workspace/company-status-labels';
import {
  currentBrasiliaMonth,
  formatCalendarDate,
  formatServerInstant,
} from '../../../../lib/dates';

const linkClass = 'tw:text-brand tw:underline tw:underline-offset-4';
const cardClass =
  'tw:grid tw:min-w-0 tw:content-start tw:gap-3 tw:rounded-panel tw:border tw:border-border-default tw:bg-panel tw:p-4 tw:wrap-anywhere';
const firstPage = 1;
type OverviewService = {
  list: (
    company: string,
    page: number,
    signal: AbortSignal,
  ) => Promise<ReturnType<typeof projectList.parse>>;
  hours: (
    company: string,
    month: string,
    page: number,
    signal: AbortSignal,
  ) => Promise<ReturnType<typeof hours.parse>>;
  catalog: (
    company: string,
    module: CatalogModule,
    month: string | null,
    page: number,
    signal: AbortSignal,
  ) => Promise<ReturnType<typeof catalog.parse>>;
  detail: (
    company: string,
    project: string,
    section: 'deliverables',
    page: number,
    signal: AbortSignal,
  ) => Promise<ReturnType<typeof projectDetail.parse> | null>;
};

export function ClientOperationsOverview({
  service,
  company,
  actor,
  account,
  canOpenRecord,
  teamOverview,
}: {
  service: OverviewService;
  company: string;
  actor?: string;
  account: CompanyAccount | null;
  canOpenRecord: boolean;
  teamOverview: ReactNode;
}) {
  const navigate = useNavigate();
  const month = currentBrasiliaMonth();
  const projects = useQuery({
    queryKey: ['projects', actor, company, firstPage],
    queryFn: ({ signal }) => service.list(company, firstPage, signal),
  });
  const hours = useQuery({
    queryKey: ['hours', actor, company, month, firstPage],
    queryFn: ({ signal }) => service.hours(company, month, firstPage, signal),
  });
  const calendar = useQuery({
    queryKey: ['phase4-catalog', actor, company, 'calendar', month, firstPage],
    queryFn: ({ signal }) => service.catalog(company, 'calendar', month, firstPage, signal),
  });
  const notices = useQuery({
    queryKey: ['phase4-catalog', actor, company, 'notices', null, firstPage],
    queryFn: ({ signal }) => service.catalog(company, 'notices', null, firstPage, signal),
  });
  const reports = useQuery({
    queryKey: ['phase4-catalog', actor, company, 'reports', null, firstPage],
    queryFn: ({ signal }) => service.catalog(company, 'reports', null, firstPage, signal),
  });
  const projectId = projects.data?.projects[0]?.id;
  const projectDetail = useQuery({
    queryKey: ['project-detail', actor, company, projectId, 'deliverables', firstPage],
    queryFn: ({ signal }) =>
      service.detail(company, projectId ?? '', 'deliverables', firstPage, signal),
    enabled: Boolean(projectId),
  });
  const search = workspaceSearch.parse({ month });
  const monthlyEvents = calendar.data?.entries
    .filter((entry) => entry.instant)
    .sort((left, right) => Date.parse(left.instant ?? '') - Date.parse(right.instant ?? ''))
    .slice(0, 3);
  const publishedNotices = notices.data?.entries.slice(0, 3);
  const feedback = reports.data?.entries.find(
    (entry) => entry.day?.slice(0, 7) === month.slice(0, 7) && entry.reportMetrics?.feedback,
  )?.reportMetrics?.feedback;
  const deliveryEntries = projectDetail.data?.items.rows ?? [];
  const nextDeliveries = [...deliveryEntries]
    .filter((entry) => entry.status !== 'cancelled' && entry.due_at)
    .sort((left, right) => Date.parse(left.due_at ?? '') - Date.parse(right.due_at ?? ''))
    .slice(0, 3);
  const pendingDeliveries = deliveryEntries.filter(
    (entry) => entry.status === 'client_review',
  ).length;
  const approvedDeliveries = deliveryEntries.filter((entry) => entry.status === 'approved').length;
  const totalDeliveries = projectDetail.data?.items.total ?? null;
  const completeDeliverySet =
    totalDeliveries !== null && deliveryEntries.length === totalDeliveries;
  const completion = completeDeliverySet
    ? Math.round((approvedDeliveries / Math.max(1, totalDeliveries ?? 0)) * 100)
    : null;
  const visibleHours = hours.data?.visible ? hours.data : null;
  const contractedMinutes = visibleHours?.capacity?.contractedMinutes;
  const usagePercent =
    visibleHours && contractedMinutes
      ? Math.round((visibleHours.minutes * 100) / contractedMinutes)
      : null;

  return (
    <div className="tw:grid tw:min-w-0 tw:gap-4" aria-label="Panorama da operação">
      <section
        aria-label="Sua contratação"
        className="tw:grid tw:min-w-0 tw:gap-4 tw:rounded-panel tw:bg-brand tw:p-5 tw:text-panel tw:wide:grid-cols-[minmax(0,1fr)_auto] tw:wide:items-center tw:wide:px-7"
        style={{
          backgroundImage:
            'linear-gradient(115deg, var(--color-brand-burgundy), #713c3e 68%, var(--color-brand-gold))',
        }}
      >
        <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
          <div
            className="tw:grid tw:size-12 tw:shrink-0 tw:place-items-center tw:rounded-control tw:bg-panel tw:text-[1.8rem] tw:font-bold tw:text-brand"
            aria-hidden="true"
          >
            {account?.displayName.trim().charAt(0).toLocaleUpperCase('pt-BR') ?? 'C'}
          </div>
          <div className="tw:min-w-0 tw:wrap-anywhere">
            <p className="tw:m-0 tw:text-caption tw:font-semibold tw:tracking-widest tw:text-panel/80 tw:uppercase">
              Sua contratação
            </p>
            <h2 className="tw:m-0 tw:text-section tw:font-semibold">
              <Link to={clientAccountPaths.company} className="tw:text-panel tw:no-underline">
                {account?.displayName ?? 'Empresa indisponível'}
              </Link>
            </h2>
            <p className="tw:m-0 tw:text-caption tw:text-panel/80">
              {account ? companyStatusLabels[account.status] : 'Situação indisponível'}
            </p>
          </div>
        </div>
        <div className="tw:flex tw:min-w-0 tw:flex-wrap tw:gap-x-6 tw:gap-y-3 tw:border-t tw:border-panel/30 tw:pt-3 tw:wide:border-t-0 tw:wide:border-l tw:wide:pt-0 tw:wide:pl-5">
          <div>
            <strong className="tw:block tw:text-section">
              {contractedMinutes != null ? <Minutes value={contractedMinutes} /> : 'Indisponível'}
            </strong>
            <span className="tw:text-caption tw:text-panel/80">contratadas no mês</span>
          </div>
          <div>
            <strong className="tw:block tw:text-section">
              {visibleHours ? <Minutes value={visibleHours.minutes} /> : 'Indisponível'}
            </strong>
            <span className="tw:text-caption tw:text-panel/80">consumidas no mês</span>
          </div>
          {usagePercent !== null && (
            <div>
              <strong className="tw:block tw:text-section">{usagePercent}%</strong>
              <span className="tw:text-caption tw:text-panel/80">utilizados</span>
            </div>
          )}
        </div>
        {usagePercent !== null && (
          <progress
            className="tw:h-2 tw:w-full tw:accent-gold tw:wide:col-span-2"
            aria-label="Horas consumidas neste mês"
            aria-valuetext={`${usagePercent}% da franquia contratada`}
            value={Math.max(0, Math.min(100, usagePercent))}
            max={100}
          />
        )}
      </section>

      {projectId && completeDeliverySet && pendingDeliveries > 0 && (
        <Link
          to="/cliente/entregaveis"
          search={workspaceSearch.parse({ project: projectId })}
          className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-control tw:bg-[color-mix(in_srgb,var(--color-brand-gold)_25%,var(--surface-panel))] tw:px-4 tw:py-2 tw:font-semibold tw:text-brand tw:no-underline tw:hover:underline"
        >
          {pendingDeliveries} {pendingDeliveries === 1 ? 'entrega aguarda' : 'entregas aguardam'}{' '}
          sua validação
          <ChevronRight size={15} aria-hidden="true" />
        </Link>
      )}

      <div className="tw:grid tw:min-w-0 tw:gap-3 tw:wide:grid-cols-3">
        <section className={cardClass} aria-labelledby="client-home-delivery-title">
          <h2 id="client-home-delivery-title" className="tw:m-0 tw:text-section tw:font-semibold">
            Entregas do ciclo
          </h2>
          {projects.isPending || (Boolean(projectId) && projectDetail.isPending) ? (
            <p className="tw:m-0 tw:text-muted-copy">Consultando entregas…</p>
          ) : projects.isError || projectDetail.isError ? (
            <p className="tw:m-0 tw:text-muted-copy">Resumo de entregas indisponível.</p>
          ) : projectDetail.data ? (
            <>
              <p className="tw:m-0">
                <strong className="tw:text-[2rem] tw:leading-none">{totalDeliveries}</strong> no
                projeto atual
              </p>
              <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
                {completeDeliverySet
                  ? `${approvedDeliveries} aprovadas${pendingDeliveries ? ` · ${pendingDeliveries} aguardam sua validação` : ''}`
                  : `${approvedDeliveries} aprovadas nesta página${pendingDeliveries ? ` · ${pendingDeliveries} aguardam sua validação nesta página` : ''}`}
              </p>
              {nextDeliveries.length > 0 && (
                <ul className="tw:m-0 tw:grid tw:list-none tw:gap-1 tw:border-t tw:border-border-default tw:p-0 tw:pt-2">
                  {!completeDeliverySet && (
                    <li className="tw:text-caption tw:text-muted-copy">
                      Próximos prazos desta página
                    </li>
                  )}
                  {nextDeliveries.map((delivery) => (
                    <li key={delivery.id}>
                      <strong>{delivery.name}</strong>
                      <span className="tw:ml-2 tw:text-caption tw:text-muted-copy">
                        {delivery.due_at &&
                          (/^\d{4}-\d{2}-\d{2}$/.test(delivery.due_at)
                            ? formatCalendarDate(delivery.due_at)
                            : formatServerInstant(delivery.due_at))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : projects.data?.total === 0 ? (
            <p className="tw:m-0 tw:text-muted-copy">Nenhum projeto disponível.</p>
          ) : (
            <p className="tw:m-0 tw:text-muted-copy">Resumo de entregas indisponível.</p>
          )}
          <Link to="/cliente/entregaveis" search={workspaceSearch.parse({})} className={linkClass}>
            Ver entregáveis
          </Link>
        </section>

        <section className={cardClass} aria-labelledby="client-home-satisfaction-title">
          <h2
            id="client-home-satisfaction-title"
            className="tw:m-0 tw:text-section tw:font-semibold"
          >
            Percepção do trabalho{' '}
            <span className="tw:font-normal tw:text-muted-copy">· mês atual</span>
          </h2>
          {reports.isPending ? (
            <p className="tw:m-0 tw:text-muted-copy">Consultando avaliações…</p>
          ) : reports.isError ? (
            <FeedbackState kind="error" onRetry={() => void reports.refetch()}>
              Não foi possível consultar a satisfação.
            </FeedbackState>
          ) : feedback && feedback.count >= 2 && feedback.average !== null ? (
            <p className="tw:m-0">
              <strong className="tw:text-[2rem] tw:leading-none">
                {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(
                  feedback.average,
                )}
              </strong>{' '}
              /5 · {feedback.count} avaliações
            </p>
          ) : (
            <p className="tw:m-0 tw:text-muted-copy">
              Métrica de satisfação indisponível nos relatórios publicados.
            </p>
          )}
          <Link to="/cliente/relatorios" search={workspaceSearch.parse({})} className={linkClass}>
            Ver relatórios
          </Link>
        </section>

        <section className={cardClass} aria-labelledby="client-home-completion-title">
          <h2 id="client-home-completion-title" className="tw:m-0 tw:text-section tw:font-semibold">
            Conclusão do trabalho{' '}
            <span className="tw:font-normal tw:text-muted-copy">· projeto atual</span>
          </h2>
          {projects.isPending || (Boolean(projectId) && projectDetail.isPending) ? (
            <p className="tw:m-0 tw:text-muted-copy">Consultando atividades…</p>
          ) : projects.isError || projectDetail.isError ? (
            <p className="tw:m-0 tw:text-muted-copy">Métrica de conclusão indisponível.</p>
          ) : !projectId || projects.data?.total === 0 ? (
            <p className="tw:m-0 tw:text-muted-copy">Nenhuma entrega disponível.</p>
          ) : projectDetail.data && completion !== null ? (
            <>
              <p className="tw:m-0">
                <strong className="tw:text-[2rem] tw:leading-none">{completion}%</strong>
              </p>
              <progress
                className="tw:h-2 tw:w-full tw:accent-brand"
                aria-label="Entregas aprovadas"
                max={100}
                value={completion}
              />
              <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
                {approvedDeliveries} de {totalDeliveries} entregas aprovadas
              </p>
            </>
          ) : (
            <p className="tw:m-0 tw:text-muted-copy">Resumo parcial; indicador indisponível.</p>
          )}
          <Link to="/cliente/entregaveis" search={workspaceSearch.parse({})} className={linkClass}>
            Acompanhar entregas
          </Link>
        </section>
      </div>

      <div className="tw:grid tw:min-w-0 tw:gap-4 tw:wide:grid-cols-2">
        <section className={cardClass} aria-labelledby="client-home-notices-title">
          <div className="tw:flex tw:flex-wrap tw:items-baseline tw:justify-between tw:gap-2">
            <h2 id="client-home-notices-title" className="tw:m-0 tw:text-section tw:font-semibold">
              Avisos da sua parceria
            </h2>
            <Link to="/cliente/avisos" className={linkClass}>
              Ver mural completo
            </Link>
          </div>
          {notices.isPending ? (
            <p className="tw:m-0 tw:text-muted-copy">Consultando avisos…</p>
          ) : notices.isError ? (
            <FeedbackState kind="error" onRetry={() => void notices.refetch()}>
              Não foi possível consultar os avisos.
            </FeedbackState>
          ) : publishedNotices?.length ? (
            <ul className="tw:m-0 tw:grid tw:list-none tw:gap-0 tw:p-0">
              {publishedNotices.map((notice) => (
                <li key={notice.id} className="tw:border-t tw:border-border-default tw:py-2">
                  <strong>{notice.title}</strong>
                  {notice.summary && <p className="tw:my-1">{notice.summary}</p>}
                  {notice.noticeAcknowledged === false && (
                    <span className="tw:text-caption tw:text-muted-copy">
                      Aguardando sua ciência
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="tw:m-0 tw:text-muted-copy">Nenhum aviso publicado para sua empresa.</p>
          )}
        </section>
        {teamOverview}
      </div>

      <section className={cardClass} aria-labelledby="client-home-agenda-title">
        <div className="tw:flex tw:flex-wrap tw:items-baseline tw:justify-between tw:gap-2">
          <h2 id="client-home-agenda-title" className="tw:m-0 tw:text-section tw:font-semibold">
            Agenda compartilhada
          </h2>
          <Link to="/cliente/cronograma" search={search} className={linkClass}>
            Ver agenda
          </Link>
        </div>
        {calendar.isPending ? (
          <p className="tw:m-0 tw:text-muted-copy">Consultando agenda…</p>
        ) : calendar.isError ? (
          <FeedbackState kind="error" onRetry={() => void calendar.refetch()}>
            Não foi possível consultar a agenda.
          </FeedbackState>
        ) : monthlyEvents?.length ? (
          <ul className="tw:m-0 tw:grid tw:list-none tw:gap-0 tw:p-0">
            {monthlyEvents.map((entry) => (
              <li key={entry.id} className="tw:border-t tw:border-border-default tw:py-2">
                <strong>{entry.title}</strong>
                {entry.instant && (
                  <time
                    className="tw:ml-2 tw:text-caption tw:text-muted-copy"
                    dateTime={entry.instant}
                  >
                    {formatServerInstant(entry.instant)}
                  </time>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="tw:m-0 tw:text-muted-copy">Nenhum compromisso publicado neste mês.</p>
        )}
      </section>

      {canOpenRecord && (
        <section className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3 tw:border-t tw:border-border-default tw:pt-4">
          <div>
            <h2 className="tw:m-0 tw:text-section tw:font-semibold">Precisa falar com a CALI?</h2>
            <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
              Registre sua solicitação em Ocorrências.
            </p>
          </div>
          <OpenRecord
            company={company}
            actor={actor}
            admin={false}
            select={(record) =>
              void navigate({ to: '/cliente/registros', search: workspaceSearch.parse({ record }) })
            }
          />
        </section>
      )}
    </div>
  );
}
