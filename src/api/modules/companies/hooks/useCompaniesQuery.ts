import { queryOptions, useQuery } from '@tanstack/react-query';
import { companiesService, mockActorId } from '../api';
import { companyKeys } from '../keys';
import { type CompanyFilters } from '../schemas';

export const companiesQueryOptions = (filters: CompanyFilters) =>
  queryOptions({
    queryKey: companyKeys.list(mockActorId, filters),
    queryFn: ({ signal }) => companiesService.list(filters, signal),
  });

export function useCompaniesQuery(filters: CompanyFilters) {
  return useQuery(companiesQueryOptions(filters));
}
