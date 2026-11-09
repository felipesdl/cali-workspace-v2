import { useRouteContext } from '@tanstack/react-router';
import { useWorkspaceSession } from '../../api/modules/access/hooks/useWorkspaceSession';
import { workspaceRole } from '../../api/modules/access/schemas';
import { isPilotCompany } from '../../api/modules/companies/onboarding';
import { type WorkspaceSearch } from '../../api/modules/project-workspace/schemas';

export function useProjectWorkspaceScope(search: Pick<WorkspaceSearch, 'companyId'>) {
  const { projectWorkspace, session } = useRouteContext({ from: '__root__' });
  const state = useWorkspaceSession();
  const profile =
    state.phase === 'resolved' && state.access.status === 'ready' ? state.access.profile : null;
  const admin = profile?.role === workspaceRole.Admin;
  const requested = admin ? search.companyId : (profile?.company_id ?? undefined);
  return {
    service: projectWorkspace,
    actor: profile?.id,
    companyId: profile?.active && isPilotCompany(requested) ? requested : undefined,
    admin,
    connected: session !== null,
  };
}
