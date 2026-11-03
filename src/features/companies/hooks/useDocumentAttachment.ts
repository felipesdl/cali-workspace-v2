import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import {
  companyDocumentType,
  type CompanyDocument,
} from '../../../api/modules/companies/document-schemas';
import { useAttachCompanyDocument } from '../../../api/modules/companies/hooks/useCompanyManagement';
const fields = z.strictObject({
  documentType: z.enum(companyDocumentType),
  documentDate: z
    .string()
    .transform((value) => value || null)
    .pipe(z.iso.date().nullable()),
});
export function useDocumentAttachment(
  companyId: string,
  previous: CompanyDocument | null,
  onClose: (saved: boolean) => void,
) {
  const [original] = useState(() => previous);
  const [requestId] = useState(() => crypto.randomUUID());
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const attach = useAttachCompanyDocument();
  const form = useForm({
    defaultValues: {
      documentType: original?.documentType ?? companyDocumentType.Contract,
      documentDate: original?.documentDate ?? '',
    },
    validators: { onChange: fields, onSubmit: fields },
    onSubmit: async ({ value }) => {
      if (!file) {
        setFileError('Selecione o arquivo do documento.');
        return;
      }
      setFileError('');
      try {
        const parsed = fields.parse(value);
        await attach.mutateAsync({
          command: {
            ...parsed,
            companyId,
            requestId,
            documentId: original?.documentId ?? null,
            expectedVersionId: original?.id ?? null,
          },
          file,
        });
        onClose(true);
      } catch {
        /* Mutation preserva falha/rascunho. */
      }
    },
  });
  function choose(file: File | null) {
    setFile(file);
    setFileError('');
    attach.reset();
  }
  return { form, file, choose, fileError, attach };
}
