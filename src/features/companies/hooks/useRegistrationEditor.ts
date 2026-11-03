import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { type CompanyRegistrationRecord } from '../../../api/modules/companies/registration-schemas';
import { useUpdateRegistration } from '../../../api/modules/companies/hooks/useCompanyManagement';
import { registrationDraftSchema, registrationToDraft } from '../registration-draft';
import { useLogoSelection } from './useLogoSelection';
export function useRegistrationEditor(
  record: CompanyRegistrationRecord,
  onClose: (saved: boolean) => void,
) {
  const [original] = useState(() => structuredClone(record));
  const [requestId] = useState(() => crypto.randomUUID());
  const update = useUpdateRegistration();
  const form = useForm({
    defaultValues: registrationToDraft(original.values),
    validators: { onChange: registrationDraftSchema, onSubmit: registrationDraftSchema },
    onSubmit: async ({ value }) => {
      try {
        await update.mutateAsync({
          companyId: original.companyId,
          expectedRevision: original.revision,
          requestId,
          values: registrationDraftSchema.parse(value),
        });
        onClose(true);
      } catch {
        /* Rascunho/revisão preservados, sem retry automático. */
      }
    },
  });
  const logo = useLogoSelection((value) => form.setFieldValue('logo', value));
  return { form, update, logo };
}
