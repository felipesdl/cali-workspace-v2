import { useRouteContext } from '@tanstack/react-router';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useWorkspaceSession } from '../../access/hooks/useWorkspaceSession';
import { workspaceRole } from '../../access/schemas';

export function useAdminOverviewSnapshot(companyId: string | undefined, month: string) {
  const { adminPortfolio } = useRouteContext({ from: '__root__' });
  const session = useWorkspaceSession();
  const profile =
    session.phase === 'resolved' && session.access.status === 'ready'
      ? session.access.profile
      : null;
  const read = profile?.role === workspaceRole.Admin ? adminPortfolio?.snapshot : undefined;
  const scope = companyId ?? null;
  const query = useQuery({
    queryKey: ['admin-overview', profile?.id, scope, month],
    queryFn: read ? ({ signal }) => read(scope, month, signal) : skipToken,
  });
  return { available: Boolean(read), query };
}
