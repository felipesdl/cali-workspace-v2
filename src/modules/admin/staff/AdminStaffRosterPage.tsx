import { PartnerHoursQueue } from '../../partner/home/components/PartnerHoursQueue';
import { PartnerReviewQueue } from '../../partner/home/components/PartnerReviewQueue';
import { StaffActivation, StaffDraftEditor } from './components/StaffDraftEditor';
import { staffModuleLabels } from './staff-module-labels';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi, useRouteContext } from '@tanstack/react-router';
import { useProjectWorkspaceScope } from '../../../components/workspace/useProjectWorkspaceScope';
import { FeedbackState } from '../../../components/ds/feedback/FeedbackState';
import { formatServerInstant } from '../../../lib/dates';
import { CompanySelect } from '../../../components/workspace/WorkspaceCompanySelect';
import { Pages } from '../../../components/workspace/WorkspacePages';
import { type Props } from '../../../components/workspace/workspace-presentation';

const adminStaffRoster = getRouteApi('/admin/equipe-cali');

const staffInvitationLabels = {
  not_invited: 'Convite pendente de envio',
  invited: 'Convite registrado',
  accepted: 'Convite aceito',
};

export function AdminStaffRosterPage() {
  const { adminRead, domainOperations, partnerPilot } = useRouteContext({ from: '__root__' });
  const search = adminStaffRoster.useSearch();
  const navigate = adminStaffRoster.useNavigate();
  const { companyId, actor, admin } = useProjectWorkspaceScope(search);
  const update: Props['update'] = (change) => void navigate({ search: { ...search, ...change } });
  const cache = useQueryClient();
  const key = ['phase4-staff-roster', actor, companyId];
  const refresh = () => cache.invalidateQueries({ queryKey: key });
  const result = useQuery({
    queryKey: [...key, search.page],
    queryFn:
      admin && adminRead && companyId
        ? ({ signal }) => adminRead.staffRoster(companyId, search.page, signal)
        : skipToken,
  });
  if (!admin || !adminRead) return null;

  return (
    <section className="tw:grid tw:gap-4" aria-label="Equipe CALI vinculada à empresa">
      <CompanySelect search={search} update={update} />
      {companyId && domainOperations && (
        <StaffDraftEditor
          key={companyId}
          company={companyId}
          operations={domainOperations}
          saved={refresh}
        />
      )}
      {companyId && partnerPilot && (
        <PartnerReviewQueue
          key={companyId}
          api={partnerPilot}
          company={companyId}
          actor={actor}
          admin
        />
      )}
      {companyId && partnerPilot && (
        <PartnerHoursQueue
          key={companyId}
          api={partnerPilot}
          company={companyId}
          actor={actor}
          admin
        />
      )}
      {!companyId ? (
        <FeedbackState kind="empty">Selecione uma empresa.</FeedbackState>
      ) : result.isPending ? (
        <FeedbackState kind="loading">Carregando vínculos da equipe…</FeedbackState>
      ) : result.isError ? (
        <FeedbackState kind="error" onRetry={() => void result.refetch()}>
          Não foi possível consultar a equipe CALI.
        </FeedbackState>
      ) : (
        <>
          {result.data.entries.length ? (
            <ul className="tw:m-0 tw:grid tw:list-none tw:p-0">
              {result.data.entries.map((member) => (
                <li
                  key={member.id}
                  className="tw:border-line first:tw:border-t tw:grid tw:gap-3 tw:border-b tw:px-0 tw:py-4 tw:wrap-anywhere"
                >
                  <div className="tw:grid tw:min-w-0 tw:gap-2 tw:mobile:grid-cols-[minmax(0,1fr)_auto] tw:mobile:items-start">
                    <div className="tw:min-w-0">
                      <h2 className="tw:m-0 tw:font-semibold">
                        {member.name ?? 'Nome não informado'}
                      </h2>
                      <p className="tw:text-detail tw:m-0 tw:mt-1 tw:text-muted-copy">
                        {member.active ? 'Ativo' : 'Inativo'} ·{' '}
                        {staffInvitationLabels[member.invitation]}
                      </p>
                    </div>
                    {member.assignedAt && (
                      <p className="tw:text-detail tw:m-0 tw:text-muted-copy">
                        Vínculo desde {formatServerInstant(member.assignedAt)} (Brasília)
                      </p>
                    )}
                  </div>
                  <div
                    className="tw:flex tw:flex-wrap tw:items-center tw:gap-2"
                    aria-label="Módulos atribuídos"
                  >
                    {member.modules?.length ? (
                      member.modules.map((module) => (
                        <span
                          key={
                            staffModuleLabels[module as keyof typeof staffModuleLabels] ?? module
                          }
                          className="tw:border-line tw:text-detail tw:border tw:px-2 tw:py-1"
                        >
                          {staffModuleLabels[module as keyof typeof staffModuleLabels] ?? module}
                        </span>
                      ))
                    ) : (
                      <span className="tw:text-detail tw:text-muted-copy">
                        Sem módulos atribuídos
                      </span>
                    )}
                  </div>
                  <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
                    {domainOperations && member.activationRevision && (
                      <StaffActivation
                        key={'activation-' + member.activationRevision}
                        company={companyId}
                        member={member.id}
                        active={member.active}
                        revision={member.activationRevision}
                        operations={domainOperations}
                        saved={refresh}
                      />
                    )}
                    {domainOperations && member.draftRevision && (
                      <StaffDraftEditor
                        key={member.draftRevision}
                        company={companyId}
                        operations={domainOperations}
                        saved={refresh}
                        draft={{
                          id: member.id,
                          revision: member.draftRevision,
                          name: member.name?.replace(/^\[TESTE V2\] /, '') ?? '',
                          modules: member.modules ?? [],
                        }}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <FeedbackState kind="empty">Nenhum membro vinculado nesta página.</FeedbackState>
          )}
          <Pages total={result.data.total} search={search} update={update} />
        </>
      )}
    </section>
  );
}
