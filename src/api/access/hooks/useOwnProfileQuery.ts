import { skipToken, useQuery } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { useWorkspaceSession } from './useWorkspaceSession';
import { ownProfileKey } from './useUpdateOwnProfile';

export function useOwnProfileQuery() {
  const { ownProfile } = useRouteContext({ from: '__root__' });
  const state = useWorkspaceSession();
  const actor =
    state.phase === 'resolved' && state.access.status === 'ready' ? state.access.profile : null;
  const query = useQuery({
    queryKey: ownProfileKey(actor?.id),
    queryFn:
      ownProfile && actor?.active ? ({ signal }) => ownProfile.read(actor.id, signal) : skipToken,
  });
  return { ownProfile, actor, query };
}
