import { useRouteContext } from '@tanstack/react-router';
import { useWorkspaceSession } from '../../api/access/hooks/useWorkspaceSession';
import { workspaceRole } from '../../api/access/schemas';
import { isPilotCompany } from '../../api/admin/companies/onboarding';
import { type WorkspaceSearch } from '../../api/shared/workspace/schemas';

export function useProjectWorkspaceScope(search: Pick<WorkspaceSearch, 'companyId'>) {
  const { projectWorkspace } = useRouteContext({ from: '__root__' });
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
  };
}
