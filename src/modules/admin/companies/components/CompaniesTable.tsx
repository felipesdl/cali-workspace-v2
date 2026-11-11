import { type CompanyFilters } from '../../../../api/admin/companies/schemas';
import { useCompaniesQuery } from '../../../../api/admin/companies/hooks/useCompaniesQuery';
import { Button } from '../../../../components/ds/button/Button';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';
import { formatCalendarDate } from '../../../../lib/dates';
import { companyPlanLabels } from './presentation';
import { companyStatusLabels } from '../../../../components/workspace/company-status-labels';

const cellLabel = 'tw:hidden tw:mobile:block tw:mobile:text-caption tw:mobile:text-muted-copy';

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
          aria-label="Tabela de empresas"
          tabIndex={0}
        >
          <table
            role="table"
            className="tw:w-full tw:min-w-[31rem] tw:border-collapse tw:text-left tw:mobile:block tw:mobile:min-w-0 tw:[&_:is(th,td)]:border-b tw:[&_:is(th,td)]:border-border-default tw:[&_:is(th,td)]:p-3 tw:mobile:[&_:is(th,td)]:border-0 tw:mobile:[&_:is(th,td)]:p-0"
          >
            <caption className="tw:pb-3 tw:text-left tw:text-muted-copy tw:mobile:block">
              {companies.data.length}{' '}
              {companies.data.length === 1 ? 'empresa no resultado' : 'empresas no resultado'}
            </caption>
            <thead
              role="rowgroup"
              className="tw:mobile:sr-only tw:[&_th]:text-caption tw:[&_th]:whitespace-nowrap"
            >
              <tr role="row">
                <th role="columnheader" scope="col">
                  Empresa
                </th>
                <th role="columnheader" scope="col">
                  Plano
                </th>
                <th role="columnheader" scope="col">
                  Situação
                </th>
                <th role="columnheader" scope="col">
                  Cadastro
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup" className="tw:mobile:grid tw:mobile:gap-3">
              {companies.data.map((company) => (
                <tr
                  key={company.id}
                  role="row"
                  className="tw:mobile:grid tw:mobile:min-w-0 tw:mobile:gap-3 tw:mobile:rounded-control tw:mobile:border tw:mobile:border-border-default tw:mobile:p-3"
                >
                  <th scope="row" role="rowheader">
                    <div className="tw:grid tw:max-w-64 tw:min-w-36 tw:justify-items-start tw:gap-2 tw:wrap-anywhere tw:mobile:max-w-none tw:mobile:min-w-0">
                      {company.displayName}
                      <Button
                        variant="secondary"
                        className="tw:mobile:w-full"
                        aria-label={`Ver acessos de ${company.displayName}`}
                        onClick={() => onSelect(company.id)}
                      >
                        Ver acessos
                      </Button>
                    </div>
                  </th>
                  <td role="cell" className="tw:wrap-anywhere">
                    <span aria-hidden="true" className={cellLabel}>
                      Plano
                    </span>
                    {company.plan ? companyPlanLabels[company.plan] : 'Não informado'}
                  </td>
                  <td role="cell">
                    <span aria-hidden="true" className={cellLabel}>
                      Situação
                    </span>
                    {companyStatusLabels[company.status]}
                  </td>
                  <td role="cell">
                    <span aria-hidden="true" className={cellLabel}>
                      Cadastro
                    </span>
                    {formatCalendarDate(company.createdOn)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {companies.isSuccess && companies.data.length > 0 && (
        <p className="tw:hidden tw:text-caption tw:leading-normal tw:text-muted-copy tw:compact:block tw:mobile:hidden!">
          Role a tabela para ver plano, situação e cadastro.
        </p>
      )}
    </section>
  );
}
