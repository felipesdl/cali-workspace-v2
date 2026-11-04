import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { companyKeys } from '../keys';
import { useCompaniesScope } from './useCompaniesScope';

export function useCompanyCyclesQuery(companyId: string) {
  const scope = useCompaniesScope();
  const load = scope.service.cycles;
  const query = useQuery({
    queryKey: companyKeys.cycles(scope.actor, companyId),
    enabled: scope.enabled,
    queryFn: load ? ({ signal }) => load(companyId, signal) : skipToken,
  });
  const cache = useQueryClient();
  const openCycle = scope.service.openCurrentCycle;
  const open = useMutation({
    mutationFn: (id: string) => {
      if (!scope.enabled || !openCycle) throw new Error('Abertura indisponível.');
      return openCycle(id);
    },
    retry: false,
    onSuccess: (_, id) =>
      cache.invalidateQueries({ queryKey: companyKeys.cycles(scope.actor, id) }),
  });
  return { available: Boolean(load), query, open, canOpen: scope.enabled && Boolean(openCycle) };
}
