import { type HostedAdministration } from '../../../api/modules/companies/hosted-administration';
import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { type CompanyAdministration } from '../../../api/modules/companies/administration-schemas';
import { useUpdateAdministration } from '../../../api/modules/companies/hooks/useCompanyManagement';
import { administrationDraftSchema, administrationToDraft } from '../administration-draft';

export function useAdministrationEditor(
  record: CompanyAdministration | HostedAdministration,
  onClose: (saved: boolean) => void,
) {
  const [original] = useState(() => structuredClone(record));
  const [requestId] = useState(() => crypto.randomUUID());
  const update = useUpdateAdministration();
  const form = useForm({
    defaultValues: administrationToDraft(original.values),
    validators: { onChange: administrationDraftSchema, onSubmit: administrationDraftSchema },
    onSubmit: async ({ value }) => {
      try {
        await update.mutateAsync({
          record: original,
          requestId,
          values: administrationDraftSchema.parse(value),
        });
        onClose(true);
      } catch {
        // Rascunho/snapshot preservados; conflito não repete nem sobrescreve a operação.
      }
    },
  });
  return { form, update };
}
