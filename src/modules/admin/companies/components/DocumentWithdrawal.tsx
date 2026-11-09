import { FormActions } from '../../../../components/ds/button/FormActions';
import { FeedbackMessage } from '../../../../components/ds/feedback/FeedbackMessage';
import { TextArea } from '../../../../components/ds/field/Controls';
import { useState } from 'react';
import { type CompanyDocument } from '../../../../api/admin/companies/document-schemas';
import { useWithdrawCompanyDocument } from '../../../../api/admin/companies/hooks/useCompanyManagement';
import { Field } from '../../../../components/ds/field/Field';
import { Button } from '../../../../components/ds/button/Button';
export function DocumentWithdrawal({
  document,
  onClose,
}: {
  document: CompanyDocument;
  onClose: (saved: boolean) => void;
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [reason, setReason] = useState('');
  const withdraw = useWithdrawCompanyDocument();
  return (
    <form
      aria-label={`Retirar documento ${document.file.fileName}`}
      className="tw:my-4 tw:grid tw:gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void withdraw
          .mutateAsync({
            requestId,
            companyId: document.companyId,
            documentId: document.documentId,
            expectedVersionId: document.id,
            reason,
          })
          .then(() => onClose(true))
          .catch(() => {});
      }}
    >
      <p>
        Retirar este documento da utilização corrente? Arquivos, versões e histórico serão
        preservados para consulta administrativa.
      </p>
      <Field id="document-withdraw-reason" label="Motivo da retirada">
        <TextArea
          id="document-withdraw-reason"
          autoFocus
          required
          value={reason}
          disabled={withdraw.isPending}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      {withdraw.isError && <FeedbackMessage tone="error">{withdraw.error.message}</FeedbackMessage>}
      <FormActions className="tw:max-w-md">
        <Button type="submit" disabled={!reason.trim()} pending={withdraw.isPending}>
          Confirmar retirada
        </Button>
        <Button variant="secondary" disabled={withdraw.isPending} onClick={() => onClose(false)}>
          Cancelar retirada
        </Button>
      </FormActions>
    </form>
  );
}
