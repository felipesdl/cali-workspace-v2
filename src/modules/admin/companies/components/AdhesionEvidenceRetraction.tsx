import { FeedbackMessage } from '../../../../components/ds/feedback/FeedbackMessage';
import { TextArea } from '../../../../components/ds/field/Controls';
import { useState } from 'react';
import { type AdhesionEvidence } from '../../../../api/admin/companies/evidence-schemas';
import { useRetractAdhesionEvidence } from '../../../../api/admin/companies/hooks/useCompanyManagement';
import { Button } from '../../../../components/ds/button/Button';
import { Field } from '../../../../components/ds/field/Field';
export function AdhesionEvidenceRetraction({
  evidence,
  onClose,
}: {
  evidence: AdhesionEvidence;
  onClose: (saved: boolean) => void;
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [reason, setReason] = useState('');
  const retract = useRetractAdhesionEvidence();
  return (
    <form
      aria-label="Retirar comprovação da adesão"
      className="tw:my-4 tw:grid tw:gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void retract
          .mutateAsync({
            requestId,
            companyId: evidence.companyId,
            evidenceId: evidence.id,
            reason,
          })
          .then(() => onClose(true))
          .catch(() => {});
      }}
    >
      <p>
        Retirar a comprovação de {evidence.reference.evidenceReference}? O registro e o motivo serão
        preservados. Esta ação não revoga acessos existentes.
      </p>
      <Field id="evidence-retraction-reason" label="Motivo da retirada da comprovação">
        <TextArea
          id="evidence-retraction-reason"
          autoFocus
          required
          value={reason}
          disabled={retract.isPending}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      {retract.isError && <FeedbackMessage tone="error">{retract.error.message}</FeedbackMessage>}
      <div className="tw:flex tw:flex-wrap tw:gap-3">
        <Button type="submit" disabled={!reason.trim()} pending={retract.isPending}>
          Confirmar retirada da comprovação
        </Button>
        <Button variant="secondary" disabled={retract.isPending} onClick={() => onClose(false)}>
          Cancelar retirada da comprovação
        </Button>
      </div>
    </form>
  );
}
