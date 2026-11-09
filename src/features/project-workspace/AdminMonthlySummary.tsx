import { currentBrasiliaMonth } from '../../lib/dates';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { type ReactNode } from 'react';
import { workspaceSearch } from '../../api/modules/project-workspace/schemas';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { Minutes } from './Minutes';
import { MonthSelect } from './WorkspaceMonthSelect';
import { type useProjectWorkspaceScope } from './useProjectWorkspaceScope';

const overview = getRouteApi('/admin/');

function MonthlyMetric({
  title,
  pending,
  failed,
  retry,
  children,
}: {
  title: string;
  pending: boolean;
  failed: boolean;
  retry: () => void;
  children?: ReactNode;
}) {
  return (
    <section className="tw:grid tw:min-w-0 tw:content-start tw:gap-2 tw:rounded-control tw:border tw:border-border-default tw:p-3">
      <h3 className="tw:m-0 tw:text-body tw:font-semibold">{title}</h3>
      {pending && <FeedbackState kind="loading">Consultando…</FeedbackState>}
      {failed && (
        <FeedbackState kind="error" onRetry={retry}>
          Não foi possível carregar este total.
        </FeedbackState>
      )}
      {children}
    </section>
  );
}

export function AdminMonthlySummary({
  service,
  actor,
  companyId,
}: {
  service: NonNullable<ReturnType<typeof useProjectWorkspaceScope>['service']>;
  actor?: string;
  companyId: string;
}) {
  const search = overview.useSearch();
  const navigate = overview.useNavigate();
  const month = search.month ?? currentBrasiliaMonth();
  const hours = useQuery({
    queryKey: ['hours', actor, companyId, month, 1],
    queryFn: ({ signal }) => service.hours(companyId, month, 1, signal),
  });
  const calendar = useQuery({
    queryKey: ['phase4-catalog', actor, companyId, 'calendar', month, 1],
    queryFn: ({ signal }) => service.catalog(companyId, 'calendar', month, 1, signal),
  });
  const detailSearch = workspaceSearch.parse({ companyId, month });

  return (
    <section
      aria-labelledby="admin-monthly-summary"
      className="tw:grid tw:min-w-0 tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4"
    >
      <h2 id="admin-monthly-summary" className="tw:m-0 tw:text-section tw:font-bold tw:text-brand">
        Resumo do mês
      </h2>
      <div className="tw:max-w-xs">
        <MonthSelect
          month={month}
          update={({ month }) => void navigate({ search: { ...search, month } })}
        />
      </div>
      <div className="tw:grid tw:min-w-0 tw:gap-3 tw:wide:grid-cols-2">
        <MonthlyMetric
          title="Horas registradas"
          pending={hours.isPending}
          failed={hours.isError}
          retry={() => void hours.refetch()}
        >
          {hours.isSuccess &&
            (hours.data.visible ? (
              <Link
                to="/admin/horas"
                search={detailSearch}
                className="tw:font-semibold tw:text-brand"
              >
                <Minutes value={hours.data.minutes} />
              </Link>
            ) : (
              <FeedbackState kind="empty">Extrato indisponível para este período.</FeedbackState>
            ))}
        </MonthlyMetric>
        <MonthlyMetric
          title="Itens na agenda"
          pending={calendar.isPending}
          failed={calendar.isError}
          retry={() => void calendar.refetch()}
        >
          {calendar.isSuccess && (
            <Link
              to="/admin/calendario"
              search={detailSearch}
              className="tw:font-semibold tw:text-brand"
            >
              {calendar.data.total} {calendar.data.total === 1 ? 'item' : 'itens'}
            </Link>
          )}
        </MonthlyMetric>
      </div>
      <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
        A agenda inclui eventos e avisos publicados no período selecionado.
      </p>
    </section>
  );
}
