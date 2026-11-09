import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { type AdminPortfolioService } from '../../api/modules/project-workspace/admin-portfolio';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { currentBrasiliaMonth } from '../../lib/dates';
import { Minutes } from './Minutes';
import { MonthSelect } from './WorkspaceMonthSelect';

const overview = getRouteApi('/admin/');
const score = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function AdminPortfolioSummary({
  service,
  actor,
}: {
  service: AdminPortfolioService;
  actor?: string;
}) {
  const search = overview.useSearch();
  const navigate = overview.useNavigate();
  const month = search.month ?? currentBrasiliaMonth();
  const result = useQuery({
    queryKey: ['admin-portfolio', actor, month],
    queryFn: ({ signal }) => service.read(month, signal),
  });
  const data = result.isSuccess ? result.data : undefined;
  const metrics = data && [
    {
      label: 'Horas registradas',
      value: <Minutes value={data.hoursMinutes} />,
      detail: 'Lançamentos do mês selecionado.',
    },
    {
      label: 'Itens na agenda',
      value: data.calendarEvents + data.calendarNotices,
      detail: `${data.calendarEvents} eventos · ${data.calendarNotices} avisos`,
    },
    {
      label: 'Prioridades operacionais',
      value: data.projectAdjustments + data.recordsInProgress,
      detail: `${data.projectAdjustments} ajustes em projetos · ${data.recordsInProgress} ocorrências em atendimento`,
    },
    {
      label: 'Satisfação',
      value:
        data.satisfactionAverage === null
          ? 'Sem avaliações'
          : `${score.format(data.satisfactionAverage)} / 5`,
      detail: `${data.satisfactionCount} avaliações no histórico da carteira`,
    },
  ];

  return (
    <section
      aria-labelledby="admin-global-summary"
      className="tw:grid tw:min-w-0 tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4"
    >
      <h2 id="admin-global-summary" className="tw:m-0 tw:text-section tw:font-bold tw:text-brand">
        Resumo da carteira
      </h2>
      <p className="tw:m-0">Horas e agenda seguem o mês selecionado.</p>
      <div className="tw:max-w-xs">
        <MonthSelect
          month={month}
          update={({ month }) => void navigate({ search: { ...search, month } })}
        />
      </div>
      {result.isPending && (
        <FeedbackState kind="loading">Consultando os totais da carteira…</FeedbackState>
      )}
      {result.isError && (
        <FeedbackState kind="error" onRetry={() => void result.refetch()}>
          Não foi possível consultar os totais da carteira.
        </FeedbackState>
      )}
      {metrics && (
        <dl className="tw:m-0 tw:grid tw:min-w-0 tw:gap-3 tw:wide:grid-cols-4">
          {metrics.map(({ label, value, detail }) => (
            <div
              key={label}
              className="tw:grid tw:min-w-0 tw:gap-2 tw:rounded-control tw:border tw:border-border-default tw:p-3 tw:wrap-anywhere"
            >
              <dt className="tw:font-semibold">{label}</dt>
              <dd className="tw:m-0 tw:text-section tw:font-bold tw:text-brand">{value}</dd>
              <dd className="tw:m-0 tw:text-caption tw:text-muted-copy">{detail}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
