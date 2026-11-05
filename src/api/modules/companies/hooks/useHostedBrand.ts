import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type HostedBrand, type HostedBrandDraft, type LogoChange } from '../hosted-brand';
import { isPilotCompany } from '../onboarding';
import { companyKeys } from '../keys';
import { useCompaniesScope } from './useCompaniesScope';

export function useHostedBrand(companyId: string) {
  const scope = useCompaniesScope();
  const available = import.meta.env.DEV && isPilotCompany(companyId);
  const service = scope.enabled && available ? scope.service.hostedBrand : undefined;
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: [...companyKeys.registration(scope.actor, companyId), 'brand'],
    queryFn: service ? ({ signal }) => service.read(companyId, signal) : skipToken,
  });
  const update = useMutation({
    mutationFn: ({
      record,
      values,
      logo,
    }: {
      record: HostedBrand;
      values: HostedBrandDraft;
      logo: LogoChange;
    }) => {
      if (!service) throw new Error('Edição indisponível.');
      return service.update(record, values, logo);
    },
    retry: false,
    onSuccess: () => cache.invalidateQueries({ queryKey: companyKeys.all(scope.actor) }),
  });
  return { available: Boolean(service), query, update };
}
