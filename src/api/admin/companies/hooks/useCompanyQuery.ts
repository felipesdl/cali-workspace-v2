import { skipToken, useQuery } from '@tanstack/react-query';
import { companyKeys } from '../keys';
import { useCompaniesScope } from './useCompaniesScope';

export function useCompanyQuery(companyId?: string) {
  const scope = useCompaniesScope();
  return useQuery({
    queryKey: companyKeys.detail(scope.actor, companyId ?? 'unselected'),
    enabled: scope.enabled,
    queryFn: companyId ? ({ signal }) => scope.service.detail(companyId, signal) : skipToken,
  });
}
