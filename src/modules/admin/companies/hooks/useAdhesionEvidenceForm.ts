import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { useConfirmAdhesionEvidence } from '../../../../api/admin/companies/hooks/useCompanyManagement';
const fields = z.strictObject({
  adhesionId: z.uuid({ error: 'Selecione a referência a comprovar.' }),
  documentVersionId: z.union([z.uuid(), z.literal('')]),
  reviewNote: z.string().trim().min(1, 'Descreva a conferência realizada.'),
  confirmed: z.boolean().refine((value) => value, 'Confirme a conferência administrativa.'),
});
export function useAdhesionEvidenceForm(companyId: string, onClose: (saved: boolean) => void) {
  const [requestId] = useState(() => crypto.randomUUID());
  const confirm = useConfirmAdhesionEvidence();
  const form = useForm({
    defaultValues: { adhesionId: '', documentVersionId: '', reviewNote: '', confirmed: false },
    validators: { onChange: fields, onSubmit: fields },
    onSubmit: async ({ value }) => {
      try {
        const parsed = fields.parse(value);
        await confirm.mutateAsync({
          requestId,
          companyId,
          adhesionId: parsed.adhesionId,
          documentVersionId: parsed.documentVersionId || null,
          reviewNote: parsed.reviewNote,
          confirmed: true,
        });
        onClose(true);
      } catch {
        /* Rascunho preservado; não há aceite jurídico ou envio. */
      }
    },
  });
  return { form, confirm };
}
