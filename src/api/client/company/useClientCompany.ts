import { workspaceRole } from '../../access/schemas';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { useWorkspaceSession } from '../../access/hooks/useWorkspaceSession';
import { companyKeys } from '../../admin/companies/keys';
export function useClientCompany() {
  const { companies, session } = useRouteContext({ from: '__root__' });
  const state = useWorkspaceSession();
  const cache = useQueryClient();
  const profile =
    state.phase === 'resolved' &&
    state.access.status === 'ready' &&
    state.access.profile?.role === workspaceRole.Client
      ? state.access.profile
      : null;
  const companyId = profile?.company_id;
  const enabled = Boolean(session && profile?.active && companyId);
  const query = useQuery({
    queryKey: companyKeys.clientAccount(profile?.id ?? 'unauthorized', companyId ?? 'unassigned'),
    queryFn:
      enabled && companyId ? ({ signal }) => companies.account(companyId, signal) : skipToken,
    enabled,
  });
  async function revalidate() {
    if (!session || !profile || !companyId) return;
    await session.revalidate();
    const current = session.getSnapshot();
    if (
      current.phase !== 'resolved' ||
      current.access.status !== 'ready' ||
      current.access.profile?.id !== profile.id ||
      current.access.profile?.company_id !== companyId ||
      current.access.profile.role !== workspaceRole.Client
    )
      return;
    await cache.invalidateQueries({
      queryKey: companyKeys.clientAccount(profile.id, companyId),
      exact: true,
    });
  }
  return { query, enabled, revalidate };
}
