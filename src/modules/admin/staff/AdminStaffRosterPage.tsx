import { PartnerHoursQueue } from '../../partner/home/components/PartnerHoursQueue';
import { PartnerReviewQueue } from '../../partner/home/components/PartnerReviewQueue';
import { StaffActivation, StaffDraftEditor } from './components/StaffDraftEditor';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi, useRouteContext } from '@tanstack/react-router';
import { useProjectWorkspaceScope } from '../../../components/workspace/useProjectWorkspaceScope';
import { FeedbackState } from '../../../components/ds/feedback/FeedbackState';
import { formatServerInstant } from '../../../lib/dates';
import { CompanySelect } from '../../../components/workspace/WorkspaceCompanySelect';
import { Pages } from '../../../components/workspace/WorkspacePages';
import { panel } from '../../../components/workspace/workspace-presentation';
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
            <ul className="tw:m-0 tw:grid tw:list-none tw:gap-3 tw:p-0">
              {result.data.entries.map((member) => (
                <li key={member.id} className={`${panel} tw:wrap-anywhere`}>
                  <h2 className="tw:font-semibold">{member.name ?? 'Nome não informado'}</h2>
                  <p>
                    {member.active ? 'Ativo' : 'Inativo'} ·{' '}
                    {staffInvitationLabels[member.invitation]}
                  </p>
                  <p>Módulos · {member.modules?.join(', ') || 'Sem módulos atribuídos'}</p>
                  {member.assignedAt && (
                    <p>Vínculo desde {formatServerInstant(member.assignedAt)} (Brasília)</p>
                  )}
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
