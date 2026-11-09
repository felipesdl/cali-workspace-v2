import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type HostedRegistration, type HostedRegistrationDraft } from '../hosted-registration';
import { isPilotCompany } from '../onboarding';
import { companyKeys } from '../keys';
import { useCompaniesScope } from './useCompaniesScope';

export function useHostedRegistration(companyId: string) {
  const scope = useCompaniesScope();
  const service = scope.enabled ? scope.service.hostedRegistration : undefined;
  const canEdit = Boolean(service && import.meta.env.DEV && isPilotCompany(companyId));
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: [...companyKeys.registration(scope.actor, companyId), 'hosted'],
    queryFn: service ? ({ signal }) => service.read(companyId, signal) : skipToken,
  });
  const update = useMutation({
    mutationFn: ({
      record,
      values,
    }: {
      record: HostedRegistration;
      values: HostedRegistrationDraft;
    }) => {
      if (!service || !canEdit) throw new Error('Edição indisponível.');
      return service.update(record, values);
    },
    retry: false,
    onSuccess: () => cache.invalidateQueries({ queryKey: companyKeys.all(scope.actor) }),
  });
  return { available: Boolean(service), canEdit, query, update };
}
