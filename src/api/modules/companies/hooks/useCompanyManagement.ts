import { type ConfirmAdhesionEvidence, type RetractAdhesionEvidence } from '../evidence-schemas';
import {
  type AttachCompanyDocument,
  type CompanyDocument,
  type WithdrawCompanyDocument,
} from '../document-schemas';
import { type UpdateRegistration } from '../registration-schemas';
import { type UpdateAdministration } from '../administration-schemas';
import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type CompanyManagement } from '../management';
import {
  type CreateCompany,
  type RegisterCompanyAdhesion,
  type AddCompanyAccess,
  type ChangeCompanyAccess,
} from '../management-schemas';
import { companyKeys } from '../keys';
import { useCompaniesScope } from './useCompaniesScope';

export function useCompanyManagementAvailable() {
  const scope = useCompaniesScope();
  return scope.enabled && scope.service.management !== null;
}
function useManagementMutation<Input, Output>(
  operation: (service: CompanyManagement, input: Input) => Promise<Output>,
) {
  const scope = useCompaniesScope();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (input: Input) => {
      if (!scope.enabled || !scope.service.management)
        throw new Error('Esta operação não está disponível neste ambiente.');
      return operation(scope.service.management, input);
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: companyKeys.all(scope.actor) }),
    retry: false,
  });
}
export function useCreateCompany() {
  return useManagementMutation((service, input: CreateCompany) => service.create(input));
}
export function useRegisterCompanyAdhesion() {
  return useManagementMutation((service, input: RegisterCompanyAdhesion) =>
    service.registerAdhesion(input),
  );
}
export function useAddCompanyAccess() {
  return useManagementMutation((service, input: AddCompanyAccess) => service.addAccess(input));
}
export function useChangeCompanyAccess() {
  return useManagementMutation((service, input: ChangeCompanyAccess) =>
    service.changeAccess(input),
  );
}
export function useCompanyAdhesions(companyId: string) {
  const scope = useCompaniesScope();
  const management = scope.service.management;
  return useQuery({
    queryKey: companyKeys.adhesions(scope.actor, companyId),
    enabled: scope.enabled,
    queryFn: management ? ({ signal }) => management.adhesions(companyId, signal) : skipToken,
  });
}
export function useCompanyAccessHistory(companyId: string) {
  const scope = useCompaniesScope();
  const management = scope.service.management;
  return useQuery({
    queryKey: companyKeys.accessHistory(scope.actor, companyId),
    enabled: scope.enabled,
    queryFn: management ? ({ signal }) => management.accessHistory(companyId, signal) : skipToken,
  });
}

export function useCompanyAdministration(companyId: string) {
  const scope = useCompaniesScope();
  const management = scope.service.management;
  return useQuery({
    queryKey: companyKeys.administration(scope.actor, companyId),
    enabled: scope.enabled,
    queryFn: management
      ? ({ signal }) => management.administration.read(companyId, signal)
      : skipToken,
  });
}
export function useAdministrationHistory(companyId: string) {
  const scope = useCompaniesScope();
  const management = scope.service.management;
  return useQuery({
    queryKey: companyKeys.administrationHistory(scope.actor, companyId),
    enabled: scope.enabled,
    queryFn: management
      ? ({ signal }) => management.administration.history(companyId, signal)
      : skipToken,
  });
}
export function useUpdateAdministration() {
  return useManagementMutation((service, input: UpdateAdministration) =>
    service.administration.update(input),
  );
}

export function useCompanyRegistration(companyId: string) {
  const scope = useCompaniesScope();
  const management = scope.service.management;
  return useQuery({
    queryKey: companyKeys.registration(scope.actor, companyId),
    enabled: scope.enabled,
    queryFn: management
      ? ({ signal }) => management.registration.read(companyId, signal)
      : skipToken,
  });
}
export function useRegistrationHistory(companyId: string) {
  const scope = useCompaniesScope();
  const management = scope.service.management;
  return useQuery({
    queryKey: companyKeys.registrationHistory(scope.actor, companyId),
    enabled: scope.enabled,
    queryFn: management
      ? ({ signal }) => management.registration.history(companyId, signal)
      : skipToken,
  });
}
export function useUpdateRegistration() {
  return useManagementMutation((service, input: UpdateRegistration) =>
    service.registration.update(input),
  );
}

export function useCompanyDocuments(companyId: string) {
  const scope = useCompaniesScope();
  const management = scope.service.management;
  return useQuery({
    queryKey: companyKeys.documents(scope.actor, companyId),
    enabled: scope.enabled,
    queryFn: management ? ({ signal }) => management.documents.list(companyId, signal) : skipToken,
  });
}
export function useDocumentHistory(companyId: string) {
  const scope = useCompaniesScope();
  const management = scope.service.management;
  return useQuery({
    queryKey: companyKeys.documentHistory(scope.actor, companyId),
    enabled: scope.enabled,
    queryFn: management
      ? ({ signal }) => management.documents.history(companyId, signal)
      : skipToken,
  });
}
export function useAttachCompanyDocument() {
  return useManagementMutation((service, input: { command: AttachCompanyDocument; file: File }) =>
    service.documents.attach(input.command, input.file),
  );
}
export function useWithdrawCompanyDocument() {
  return useManagementMutation((service, input: WithdrawCompanyDocument) =>
    service.documents.withdraw(input),
  );
}
export function useDownloadCompanyDocument() {
  const scope = useCompaniesScope();
  return useMutation({
    mutationFn: (input: CompanyDocument) => {
      if (!scope.enabled || !scope.service.management)
        throw new Error('Download indisponível neste ambiente.');
      return scope.service.management.documents.content(input);
    },
    retry: false,
  });
}

export function useAdhesionEvidence(companyId: string) {
  const scope = useCompaniesScope();
  const management = scope.service.management;
  return useQuery({
    queryKey: companyKeys.evidence(scope.actor, companyId),
    enabled: scope.enabled,
    queryFn: management ? ({ signal }) => management.evidence.list(companyId, signal) : skipToken,
  });
}
export function useConfirmAdhesionEvidence() {
  return useManagementMutation((service, input: ConfirmAdhesionEvidence) =>
    service.evidence.confirm(input),
  );
}
export function useRetractAdhesionEvidence() {
  return useManagementMutation((service, input: RetractAdhesionEvidence) =>
    service.evidence.retract(input),
  );
}
