import { Link } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useCompaniesQuery } from '../../api/modules/companies/hooks/useCompaniesQuery';
import { companyStatus } from '../../api/modules/companies/schemas';
import { AdminPriorities } from '../project-workspace/AdminPriorities';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';

const groups = [
  { status: 'all', label: 'Todas as empresas' },
  { status: companyStatus.Active, label: 'Ativas' },
  { status: companyStatus.Paused, label: 'Pausadas' },
  { status: companyStatus.Blocked, label: 'Bloqueadas' },
  { status: companyStatus.Closed, label: 'Encerradas' },
  { status: companyStatus.Archived, label: 'Arquivadas' },
] as const;

export function AdminOverview() {
  const companies = useCompaniesQuery({ q: '', status: 'all' });
  const heading = useRef<HTMLHeadingElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (!restoreFocus.current || companies.isFetching) return;
    restoreFocus.current = false;
    if (document.activeElement === document.body) heading.current?.focus();
  });

  return (
    <div className="tw:grid tw:min-w-0 tw:gap-4">
      <section
        aria-labelledby="admin-portfolio-title"
        className="tw:grid tw:min-w-0 tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4"
      >
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
        {companies.isSuccess && (
          <ul className="tw:m-0 tw:grid tw:list-none tw:gap-3 tw:p-0 tw:wide:grid-cols-3">
            {groups.map(({ status, label }) => (
              <li key={status}>
                <Link
                  to="/admin/clientes"
                  search={{ q: '', status }}
                  className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:p-3 tw:font-medium tw:text-brand tw:no-underline tw:hover:bg-ivory tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-focus"
                >
                  <span>{label}</span>
                  <strong>
                    {status === 'all'
                      ? companies.data.length
                      : companies.data.filter((company) => company.status === status).length}
                  </strong>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      {companies.isSuccess && <AdminPriorities companies={companies.data} />}
    </div>
  );
}
