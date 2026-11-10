import { isPilotCompany } from '../onboarding';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { companyKeys } from '../keys';
import { useCompaniesScope } from './useCompaniesScope';

export type PilotAccessChange = { revokedAt: string | null; requestId: string };

export function usePilotInviteStates(companyId: string) {
  const { service, actor, enabled } = useCompaniesScope();
  const onboarding =
    enabled && import.meta.env.DEV && isPilotCompany(companyId) ? service.onboarding : null;
  return useQuery({
    queryKey: companyKeys.pilotAccess(actor, companyId),
    enabled: Boolean(onboarding),
    queryFn: ({ signal }) => onboarding?.listPilotInviteStates(companyId, signal) ?? [],
    retry: false,
  });
}

export function usePilotInviteChange(companyId: string, inviteId: string) {
  const { service, actor, enabled } = useCompaniesScope();
  const cache = useQueryClient();
  const onboarding = enabled ? service.onboarding : null;
  const stateKey = companyKeys.pilotAccess(actor, companyId);
  return useMutation({
    mutationFn: ({ revokedAt, requestId }: PilotAccessChange) => {
      if (!onboarding) throw new Error('Gestão de acesso indisponível.');
      if (!revokedAt) return onboarding.revokePilotInvite(companyId, inviteId);
      return onboarding.reauthorizePilotInvite(companyId, inviteId, revokedAt, requestId);
    },
    retry: false,
    onSettled: () =>
      Promise.all([
        cache.invalidateQueries({ queryKey: stateKey }),
        cache.invalidateQueries({ queryKey: companyKeys.accesses(actor, companyId) }),
      ]),
  });
}
