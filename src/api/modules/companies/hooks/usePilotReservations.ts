import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type z } from 'zod';
import { type pilotInviteFields } from '../pilot-reservations';
import { isPilotCompany } from '../onboarding';
import { companyKeys } from '../keys';
import { useCompaniesScope } from './useCompaniesScope';

export function usePilotReservations(companyId: string) {
  const scope = useCompaniesScope();
  const available =
    scope.enabled &&
    import.meta.env.DEV &&
    import.meta.env.VITE_CALI_PILOT_PROVISIONING === 'true' &&
    isPilotCompany(companyId);
  const service = available ? scope.service.pilotReservations : undefined;
  const cache = useQueryClient();
  const key = [...companyKeys.accesses(scope.actor, companyId), 'pending'] as const;
  const query = useQuery({
    queryKey: key,
    queryFn: service ? ({ signal }) => service.list(companyId, signal) : skipToken,
    retry: false,
  });
  const reserve = useMutation({
    mutationFn: ({
      requestId,
      values,
    }: {
      requestId: string;
      values: z.input<typeof pilotInviteFields>;
    }) => {
      if (!service) throw new Error('Reservas indisponíveis.');
      return service.reserve(companyId, requestId, values);
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: key }),
    retry: false,
  });
  const cancel = useMutation({
    mutationFn: (inviteId: string) => {
      if (!service) throw new Error('Reservas indisponíveis.');
      return service.cancel(companyId, inviteId);
    },
    onSettled: () =>
      cache.invalidateQueries({ queryKey: companyKeys.accesses(scope.actor, companyId) }),
    retry: false,
  });
  return { available: Boolean(service), query, reserve, cancel };
}
