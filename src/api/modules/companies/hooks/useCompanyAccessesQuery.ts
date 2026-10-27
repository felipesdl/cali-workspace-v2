import { skipToken, useQuery } from '@tanstack/react-query';
import { companiesService, mockActorId } from '../api';
import { companyKeys } from '../keys';

export function useCompanyAccessesQuery(companyId?: string) {
  return useQuery({
    queryKey: companyKeys.accesses(mockActorId, companyId ?? 'unselected'),
    queryFn: companyId ? ({ signal }) => companiesService.accesses(companyId, signal) : skipToken,
  });
}
