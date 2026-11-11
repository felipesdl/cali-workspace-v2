import { useProjectWorkspaceScope } from '../../../components/workspace/useProjectWorkspaceScope';
import { ClientOperationsOverview } from './components/ClientOperationsOverview';
import { Link, useRouteContext } from '@tanstack/react-router';
import { useRef } from 'react';
import { clientAccountPaths } from '../../../app/navigation';
import { TeamMonthlyReminder } from './components/TeamMonthlyReminder';
import { teamSearchSchema } from '../../../api/shared/team/schemas';
import { teamViews } from '../../../api/shared/team/schemas';
import { useTeam } from '../../../api/shared/team/useTeam';
import { useClientCompany } from '../../../api/client/company/useClientCompany';
const linkClass =
  'tw:text-brand tw:underline tw:underline-offset-4 tw:visited:text-brand tw:focus-visible:outline-2 tw:focus-visible:outline-offset-3 tw:focus-visible:outline-focus';
export function ClientOverview() {
  const { session, team, domainOperations } = useRouteContext({ from: '__root__' });
  const { service, companyId, actor } = useProjectWorkspaceScope({});
  const { query: company } = useClientCompany();
  const teamSearch = teamSearchSchema.parse({
    view: teamViews.Directory,
    status: 'active',
    page: 1,
  });
  const teamState = useTeam(teamSearch);
  const teamDirectory = teamState.list;
  const accountHeading = useRef<HTMLHeadingElement>(null);
  if (!session) {
    return <p>As informações da empresa ficam disponíveis no ambiente conectado.</p>;
  }
  return (
    <div className="client-home tw:grid tw:gap-6">
      {company.data && !(service && companyId) && (
        <section className="tw:grid tw:gap-2 tw:border-b tw:border-border-default tw:pb-4">
          <h2 className="tw:m-0 tw:text-section tw:font-semibold">Sua empresa</h2>
          <Link className={linkClass} to={clientAccountPaths.company}>
            {company.data.displayName}
          </Link>
        </section>
      )}
      {service && companyId && (
        <ClientOperationsOverview
          service={service}
          company={companyId}
          actor={actor}
          account={company.data ?? null}
          canOpenRecord={Boolean(domainOperations)}
          teamOverview={
            teamState.enabled ? (
              <section
                className="tw:grid tw:min-w-0 tw:content-start tw:gap-3 tw:rounded-panel tw:border tw:border-border-default tw:bg-panel tw:p-4 tw:wrap-anywhere"
                aria-labelledby="client-home-team-title"
              >
                <div className="tw:flex tw:flex-wrap tw:items-baseline tw:justify-between tw:gap-2">
                  <h2
                    id="client-home-team-title"
                    className="tw:m-0 tw:text-section tw:font-semibold"
                  >
                    Pessoas e datas importantes
                  </h2>
                  <Link to="/cliente/equipe" search={teamSearch} className={linkClass}>
                    Ver equipe
                  </Link>
                </div>
                {teamDirectory.isPending ? (
                  <p className="tw:m-0 tw:text-muted-copy">Consultando equipe…</p>
                ) : teamDirectory.isError ? (
                  <p className="tw:m-0 tw:text-muted-copy">Resumo da equipe indisponível.</p>
                ) : teamDirectory.data?.members.length ? (
                  <ul className="tw:m-0 tw:grid tw:list-none tw:gap-0 tw:p-0">
                    {teamDirectory.data.members.slice(0, 3).map((member) => (
                      <li key={member.id} className="tw:border-t tw:border-border-default tw:py-2">
                        <strong>{member.full_name}</strong>
                        {member.job_title && (
                          <span className="tw:ml-2 tw:text-caption tw:text-muted-copy">
                            {member.job_title}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="tw:m-0 tw:text-muted-copy">Nenhuma pessoa ativa cadastrada.</p>
                )}
              </section>
            ) : null
          }
        />
      )}
      <TeamMonthlyReminder fallbackFocus={accountHeading} />
      <section aria-labelledby="client-account-access-title">
        <h2
          id="client-account-access-title"
          ref={accountHeading}
          tabIndex={-1}
          className="tw:mt-0 tw:text-section tw:text-brand"
        >
          Sua empresa no Workspace
        </h2>
        <p>
          Seu acesso foi confirmado. Consulte a identificação da sua empresa e os documentos de uso
          e privacidade.
        </p>
        <ul className="tw:grid tw:gap-3 tw:pl-5">
          {team && (
            <li>
              <Link className={linkClass} to="/cliente/equipe" search={teamSearchSchema.parse({})}>
                Consultar equipe
              </Link>
            </li>
          )}
          <li>
            <Link className={linkClass} to={clientAccountPaths.company}>
              Consultar minha empresa
            </Link>
          </li>
          <li>
            <Link className={linkClass} to={clientAccountPaths.terms}>
              Consultar termos e privacidade
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
