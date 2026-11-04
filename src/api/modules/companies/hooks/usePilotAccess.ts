import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { companyKeys } from '../keys';
import { useCompaniesScope } from './useCompaniesScope';

export type PilotAccessChange = { revokedAt: string | null; requestId: string };

export function usePilotAccess(companyId: string) {
  const { service, actor, enabled } = useCompaniesScope();
  const cache = useQueryClient();
  const onboarding = enabled ? service.onboarding : null;
  const stateKey = companyKeys.pilotAccess(actor, companyId);
  const state = useQuery({
    queryKey: stateKey,
    enabled: Boolean(onboarding),
    queryFn: ({ signal }) => onboarding?.readPilotAccessState(companyId, signal) ?? null,
    retry: false,
  });
  const change = useMutation({
    mutationFn: ({ revokedAt, requestId }: PilotAccessChange) => {
      if (!onboarding) throw new Error('Gestão de acesso indisponível.');
      if (!revokedAt) return onboarding.revokePilotAccess(companyId);
      return onboarding.reauthorizePilotAccess(companyId, revokedAt, requestId);
    },
    retry: false,
    onSettled: () =>
      Promise.all([
        cache.invalidateQueries({ queryKey: stateKey }),
        cache.invalidateQueries({ queryKey: companyKeys.accesses(actor, companyId) }),
      ]),
  });
  return { state, change, enabled: Boolean(onboarding) };
}
