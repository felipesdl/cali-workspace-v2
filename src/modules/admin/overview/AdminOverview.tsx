import { getRouteApi, Link } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useCompaniesQuery } from '../../../api/admin/companies/hooks/useCompaniesQuery';
import { companyStatus } from '../../../api/admin/companies/schemas';
import { AdminPriorities } from './components/AdminPriorities';
import { FeedbackState } from '../../../components/ds/feedback/FeedbackState';
import { Panel } from '../../../components/ds/panel/Panel';
import { OverviewFilters } from './components/OverviewFilters';
import { useAdminOverviewSnapshot } from '../../../api/admin/workspace/useAdminOverviewSnapshot';
import { currentBrasiliaMonth } from '../../../lib/dates';
import { AdminOverviewSnapshot } from './components/AdminOverviewSnapshot';
import { type Props } from '../../../components/workspace/workspace-presentation';
import { workspaceSearch } from '../../../api/shared/workspace/schemas';

const overviewRoute = getRouteApi('/admin/');

const groups = [
  { status: 'all', label: 'Todas as empresas' },
  { status: companyStatus.Active, label: 'Ativas' },
  { status: companyStatus.Paused, label: 'Pausadas' },
  { status: companyStatus.Blocked, label: 'Bloqueadas' },
  { status: companyStatus.Closed, label: 'Encerradas' },
  { status: companyStatus.Archived, label: 'Arquivadas' },
] as const;

function AdminOverviewContent({ search, update }: Props) {
  const companies = useCompaniesQuery({ q: '', status: 'all' });
  const heading = useRef<HTMLHeadingElement>(null);
  const restoreFocus = useRef(false);
  const selectedCompany = companies.data?.find((company) => company.id === search.companyId);
  const accountRows = search.companyId
    ? selectedCompany
      ? [selectedCompany]
      : []
    : companies.data;
  const month = search.month ?? currentBrasiliaMonth();
  const { available, query: snapshot } = useAdminOverviewSnapshot(search.companyId, month);
  const showPortfolioSummary = !available || (snapshot.isSuccess && snapshot.data === null);
  useEffect(() => {
    if (!restoreFocus.current || companies.isFetching) return;
    restoreFocus.current = false;
    if (document.activeElement === document.body) heading.current?.focus();
  });

  return (
    <div className="admin-overview tw:grid tw:min-w-0 tw:gap-4">
      <OverviewFilters
        companies={companies.isSuccess ? companies.data : undefined}
        companyId={search.companyId}
        month={showPortfolioSummary ? undefined : month}
        onCompany={(companyId) => update({ companyId })}
        onMonth={(month) => update({ month })}
      />
      {showPortfolioSummary ? (
        <AdminPriorities companies={companies.isSuccess ? companies.data : undefined} />
      ) : (
        <>
          {snapshot.isPending && (
            <FeedbackState kind="loading">Consultando a Visão geral…</FeedbackState>
          )}
          {snapshot.isError && (
            <FeedbackState kind="error" onRetry={() => void snapshot.refetch()}>
              Não foi possível consultar a Visão geral.
            </FeedbackState>
          )}
          {snapshot.isSuccess && snapshot.data && (
            <AdminOverviewSnapshot
              data={snapshot.data}
              companies={companies.isSuccess ? companies.data : []}
              scope={
                selectedCompany?.displayName ??
                (search.companyId ? 'Conta selecionada' : 'Todas as contas')
              }
            />
          )}
        </>
      )}
      <Panel aria-labelledby="admin-portfolio-title" className="tw:grid tw:gap-3">
        <h2
          id="admin-portfolio-title"
          ref={heading}
          tabIndex={-1}
          className="tw:m-0 tw:text-section tw:font-bold tw:text-brand"
        >
          Carteira de empresas
        </h2>
        <p className="tw:m-0">Abra uma situação para consultar as empresas e seus acessos.</p>
        {companies.isPending && <FeedbackState kind="loading">Carregando carteira…</FeedbackState>}
        {companies.isError && (
          <FeedbackState
            kind="error"
            onRetry={() => {
              restoreFocus.current = true;
              void companies.refetch();
            }}
          >
            Não foi possível consultar a carteira.
          </FeedbackState>
        )}
        {companies.isSuccess && search.companyId && !selectedCompany && (
          <FeedbackState kind="empty">Conta indisponível neste recorte.</FeedbackState>
        )}
        {accountRows && (!search.companyId || selectedCompany) && (
          <ul className="tw:m-0 tw:grid tw:list-none tw:gap-3 tw:p-0 tw:wide:grid-cols-3">
            {groups.map(({ status, label }) => (
              <li key={status}>
                <Link
                  to="/admin/clientes"
                  search={{ q: selectedCompany?.displayName ?? '', status }}
                  className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:p-3 tw:font-medium tw:text-brand tw:no-underline tw:hover:bg-ivory tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-focus"
                >
                  <span>{label}</span>
                  <strong>
                    {status === 'all'
                      ? accountRows.length
                      : accountRows.filter((company) => company.status === status).length}
                  </strong>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export function AdminOverview() {
  const search = overviewRoute.useSearch();
  const navigate = overviewRoute.useNavigate();
  const currentSearch = workspaceSearch.parse(search);
  return (
    <AdminOverviewContent
      search={currentSearch}
      update={(change) => void navigate({ search: { ...search, ...change } })}
    />
  );
}
