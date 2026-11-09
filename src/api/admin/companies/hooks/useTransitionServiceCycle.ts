import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type ServiceCycle } from '../cycles';
import { companyKeys } from '../keys';
import { useCompaniesScope } from './useCompaniesScope';

export function useTransitionServiceCycle(companyId: string, cycle: ServiceCycle) {
  const scope = useCompaniesScope();
  const cache = useQueryClient();
  const transition = scope.service.transitionServiceCycle;
  return useMutation({
    mutationFn: () => {
      if (!scope.enabled || !transition) throw new Error('Transição indisponível.');
      return transition(companyId, cycle.id, cycle.status);
    },
    retry: false,
    onSettled: () =>
      cache.invalidateQueries({ queryKey: companyKeys.cycles(scope.actor, companyId) }),
  });
}
