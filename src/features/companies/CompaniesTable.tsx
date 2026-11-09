import { type CompanyFilters } from '../../api/modules/companies/schemas';
import { useCompaniesQuery } from '../../api/modules/companies/hooks/useCompaniesQuery';
import { Button } from '../../components/ds/button/Button';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { formatCalendarDate } from '../../lib/dates';
import { companyPlanLabels, companyStatusLabels } from './presentation';

export function CompaniesTable({
  filters,
  onSelect,
}: {
  filters: CompanyFilters;
  onSelect: (companyId: string) => void;
}) {
  const companies = useCompaniesQuery(filters);
  return (
    <section
      className="tw:min-w-0 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4"
      aria-labelledby="companies-title"
      aria-busy={companies.isFetching}
    >
      <h2 className="tw:sr-only" id="companies-title">
        Resultado da busca de empresas
      </h2>
      {companies.isPending && <FeedbackState kind="loading">Carregando empresas…</FeedbackState>}
      {companies.isError && (
        <FeedbackState
          kind="error"
          retryVariant="secondary"
          onRetry={() => void companies.refetch()}
        >
          Não foi possível carregar as empresas.
        </FeedbackState>
      )}
      {companies.isSuccess && companies.data.length === 0 && (
        <FeedbackState kind="empty">Nenhuma empresa encontrada com estes filtros.</FeedbackState>
      )}
      {companies.isSuccess && companies.data.length > 0 && (
        <div
          className="tw:overflow-x-auto tw:focus-visible:outline-2 tw:focus-visible:outline-offset-3 tw:focus-visible:outline-focus"
          role="region"
          aria-label="Tabela de empresas; role horizontalmente para ver todas as colunas"
          tabIndex={0}
        >
          <table className="tw:w-full tw:min-w-[31rem] tw:border-collapse tw:text-left tw:[&_:is(th,td)]:border-b tw:[&_:is(th,td)]:border-border-default tw:[&_:is(th,td)]:p-3 tw:mobile:[&_:is(th,td)]:p-2">
            <caption className="tw:pb-3 tw:text-left tw:text-muted-copy">
              {companies.data.length}{' '}
              {companies.data.length === 1 ? 'empresa no resultado' : 'empresas no resultado'}
            </caption>
            <thead className="tw:[&_th]:text-caption tw:[&_th]:whitespace-nowrap">
              <tr>
                <th scope="col">Empresa</th>
                <th scope="col">Plano</th>
                <th scope="col">Situação</th>
                <th scope="col">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {companies.data.map((company) => (
                <tr key={company.id}>
                  <th scope="row">
                    <div className="tw:grid tw:max-w-64 tw:min-w-36 tw:justify-items-start tw:gap-2 tw:wrap-anywhere">
                      {company.displayName}
                      <Button
                        variant="secondary"
                        aria-label={`Ver acessos de ${company.displayName}`}
                        onClick={() => onSelect(company.id)}
                      >
                        Ver acessos
                      </Button>
                    </div>
                  </th>
                  <td>{company.plan ? companyPlanLabels[company.plan] : 'Não informado'}</td>
                  <td>{companyStatusLabels[company.status]}</td>
                  <td>{formatCalendarDate(company.createdOn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {companies.isSuccess && companies.data.length > 0 && (
        <p className="tw:hidden tw:text-caption tw:leading-normal tw:text-muted-copy tw:compact:block">
          Role a tabela para ver plano, situação e cadastro.
        </p>
      )}
    </section>
  );
}
