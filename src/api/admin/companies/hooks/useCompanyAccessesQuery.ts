import { skipToken, useQuery } from '@tanstack/react-query';
import { companyKeys } from '../keys';
import { useCompaniesScope } from './useCompaniesScope';

export function useCompanyAccessesQuery(companyId?: string) {
  const scope = useCompaniesScope();
  return useQuery({
    queryKey: companyKeys.accesses(scope.actor, companyId ?? 'unselected'),
    enabled: scope.enabled,
    queryFn: companyId ? ({ signal }) => scope.service.accesses(companyId, signal) : skipToken,
  });
}
