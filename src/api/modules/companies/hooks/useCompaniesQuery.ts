import { queryOptions, useQuery } from '@tanstack/react-query';
import { companiesService, mockActorId } from '../api';
import { companyKeys } from '../keys';
import { type CompanyFilters } from '../schemas';
import { useCompaniesScope } from './useCompaniesScope';

// Opções demonstrativas também usadas pelos testes do módulo.
export const companiesQueryOptions = (filters: CompanyFilters) =>
  queryOptions({
    queryKey: companyKeys.list(mockActorId, filters),
    queryFn: ({ signal }) => companiesService.list(filters, signal),
  });

export function useCompaniesQuery(filters: CompanyFilters) {
  const scope = useCompaniesScope();
  return useQuery({
    queryKey: companyKeys.list(scope.actor, filters),
    enabled: scope.enabled,
    queryFn: ({ signal }) => scope.service.list(filters, signal),
  });
}
