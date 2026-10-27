import { skipToken, useQuery } from '@tanstack/react-query';
import { companiesService, mockActorId } from '../api';
import { companyKeys } from '../keys';

export function useCompanyQuery(companyId?: string) {
  return useQuery({
    queryKey: companyKeys.detail(mockActorId, companyId ?? 'unselected'),
    queryFn: companyId ? ({ signal }) => companiesService.detail(companyId, signal) : skipToken,
  });
}
