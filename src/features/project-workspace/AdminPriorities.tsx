import { skipToken, useQuery } from '@tanstack/react-query';
import { getRouteApi, Link, useRouteContext } from '@tanstack/react-router';
import { isPilotCompany } from '../../api/modules/companies/onboarding';
import { type Company } from '../../api/modules/companies/schemas';
import { workspaceSearch } from '../../api/modules/project-workspace/schemas';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { Select } from '../../components/ds/field/Controls';
import { Field } from '../../components/ds/field/Field';
import { useProjectWorkspaceScope } from './useProjectWorkspaceScope';
import { recordStatusLabel, workspaceLabel } from './workspace-labels';

const overviewRoute = getRouteApi('/admin/');
const firstPage = 1;
const listStyle = 'tw:m-0 tw:grid tw:list-none tw:gap-2 tw:p-0';
const linkStyle =
  'tw:block tw:rounded-control tw:border tw:border-border-default tw:p-3 tw:text-brand tw:no-underline tw:wrap-anywhere tw:hover:bg-ivory tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-focus';

export function AdminPriorities({ companies }: { companies: readonly Company[] }) {
  const search = overviewRoute.useSearch();
  const navigate = overviewRoute.useNavigate();
  const { domainOperations } = useRouteContext({ from: '__root__' });
  const { service, admin, actor, companyId } = useProjectWorkspaceScope(search);
  const projects = useQuery({
    queryKey: ['projects', actor, companyId, firstPage],
    queryFn:
      service && companyId && admin
        ? ({ signal }) => service.list(companyId, firstPage, signal)
        : skipToken,
  });
  const records = useQuery({
    queryKey: ['phase4-catalog', actor, companyId, 'records', null, firstPage],
    queryFn:
      service && companyId && admin && domainOperations
        ? ({ signal }) => service.catalog(companyId, 'records', null, firstPage, signal)
        : skipToken,
  });
  if (!service || !admin) return null;
  const pilotCompanies = companies.filter((company) => isPilotCompany(company.id));
  const adjustments = projects.data?.projects.filter(
    (project) =>
      project.planning_status === 'adjustment_requested' && project.execution_status === 'normal',
  );
  const inProgress = records.data?.entries.filter((record) => record.status === 'in_progress');
  return (
    <section
      aria-labelledby="admin-priorities-title"
      className="tw:grid tw:min-w-0 tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4"
    >
      <h2 id="admin-priorities-title" className="tw:m-0 tw:text-section tw:font-bold tw:text-brand">
        Prioridades operacionais
      </h2>
      <p className="tw:m-0">
        Acompanhe ajustes solicitados em projetos e ocorrências em atendimento.
      </p>
      <Field id="priorities-company" label="Empresa de homologação">
        <Select
          id="priorities-company"
          value={companyId ?? ''}
          onChange={(event) =>
            void navigate({ search: { companyId: event.currentTarget.value || undefined } })
          }
        >
          <option value="">Selecione uma empresa</option>
          {pilotCompanies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.displayName}
            </option>
          ))}
        </Select>
      </Field>
      {companyId && (
        <div className="tw:grid tw:min-w-0 tw:gap-4 tw:wide:grid-cols-2">
          <section className="tw:grid tw:min-w-0 tw:content-start tw:gap-2">
            <h3 className="tw:m-0 tw:text-body tw:font-semibold">Ajustes em projetos</h3>
            {projects.isPending && (
              <FeedbackState kind="loading">Carregando projetos…</FeedbackState>
            )}
            {projects.isError && (
              <FeedbackState kind="error" onRetry={() => void projects.refetch()}>
                Não foi possível consultar os projetos.
              </FeedbackState>
            )}
            {projects.isSuccess && (
              <>
                <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
                  Primeira página da lista de projetos. Consulte Projetos para ver a lista completa.
                </p>
                {!adjustments?.length && (
                  <FeedbackState kind="empty">Nenhum ajuste nesta página.</FeedbackState>
                )}
                <ul className={listStyle}>
                  {adjustments?.map((project) => (
                    <li key={project.id}>
                      <Link
                        to="/admin/projetos"
                        search={workspaceSearch.parse({
                          companyId,
                          project: project.id,
                          projectView: 'roadmap',
                        })}
                        className={linkStyle}
                      >
                        <strong className="tw:block">{project.name}</strong>
                        <span className="tw:text-caption tw:text-muted-copy">
                          {workspaceLabel(project.planning_status)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
          {domainOperations && (
            <section className="tw:grid tw:min-w-0 tw:content-start tw:gap-2">
              <h3 className="tw:m-0 tw:text-body tw:font-semibold">Ocorrências em atendimento</h3>
              {records.isPending && (
                <FeedbackState kind="loading">Carregando ocorrências…</FeedbackState>
              )}
              {records.isError && (
                <FeedbackState kind="error" onRetry={() => void records.refetch()}>
                  Não foi possível consultar as ocorrências.
                </FeedbackState>
              )}
              {records.isSuccess && (
                <>
                  <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
                    Primeira página da lista de ocorrências. Consulte Ocorrências para ver a lista
                    completa.
                  </p>
                  {!inProgress?.length && (
                    <FeedbackState kind="empty">
                      Nenhuma ocorrência em atendimento nesta página.
                    </FeedbackState>
                  )}
                  <ul className={listStyle}>
                    {inProgress?.map((record) => (
                      <li key={record.id}>
                        <Link
                          to="/admin/registros"
                          search={workspaceSearch.parse({ companyId, record: record.id })}
                          className={linkStyle}
                        >
                          <strong className="tw:block">{record.title}</strong>
                          <span className="tw:text-caption tw:text-muted-copy">
                            {recordStatusLabel(record.status ?? '')}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
        </div>
      )}
    </section>
  );
}
