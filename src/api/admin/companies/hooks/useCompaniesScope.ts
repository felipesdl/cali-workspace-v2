import { workspaceRole } from '../../../access/schemas';
import { useRouteContext } from '@tanstack/react-router';
import { useWorkspaceSession } from '../../../access/hooks/useWorkspaceSession';

export function useCompaniesScope() {
  const { companies, session } = useRouteContext({ from: '__root__' });
  const state = useWorkspaceSession();
  const access =
    state.phase === 'resolved' && state.access.status === 'ready' ? state.access : null;
  return {
    service: companies,
    actor: session
      ? `${access?.profile?.id ?? 'unauthorized'}:${access?.profile?.company_id ?? 'admin'}`
      : 'mock-admin',
    enabled: !session || access?.profile?.role === workspaceRole.Admin,
  };
}
