import { skipToken, useQuery } from '@tanstack/react-query';
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
  return { available: Boolean(load), query };
}
