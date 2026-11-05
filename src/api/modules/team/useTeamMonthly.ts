import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { useWorkspaceSession } from '../access/hooks/useWorkspaceSession';
import { isPilotCompany } from '../companies/onboarding';
import { type TeamSearch } from './schemas';
import { writeMonthOptions } from './maintenance';
import { type MonthlyCommand } from './monthly';

export function useTeamMonthly(search: Pick<TeamSearch, 'companyId' | 'month'>) {
  const { monthly } = useRouteContext({ from: '__root__' });
  const session = useWorkspaceSession();
  const profile =
    session.phase === 'resolved' && session.access.status === 'ready'
      ? session.access.profile
      : null;
  const companyId = profile?.role === 'admin' ? search.companyId : profile?.company_id;
  const month = `${search.month ?? writeMonthOptions()[0]}-01`;
  const enabled = Boolean(monthly && profile?.active && companyId && isPilotCompany(companyId));
  const key = ['team-monthly', profile?.id, companyId] as const;
  const cache = useQueryClient();
  const state = useQuery({
    queryKey: [...key, month],
    queryFn:
      enabled && monthly && companyId
        ? ({ signal }) => monthly.read(companyId, month, signal)
        : skipToken,
  });
  const write = useMutation({
    mutationFn: (command: Omit<MonthlyCommand, 'companyId' | 'month'>) => {
      if (!enabled || !monthly || !companyId) throw new Error('Dados mensais indisponíveis.');
      return monthly.write({ ...command, companyId, month });
    },
    retry: false,
    onSuccess: () => cache.invalidateQueries({ queryKey: key }),
  });
  return {
    state,
    write,
    companyId,
    month,
    enabled,
    admin: profile?.role === 'admin',
    available: Boolean(monthly),
  };
}
