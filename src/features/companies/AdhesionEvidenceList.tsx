import {
  adhesionEvidenceStatus,
  type AdhesionEvidence,
} from '../../api/modules/companies/evidence-schemas';
import { Button } from '../../components/ds/button/Button';
import { formatServerInstant } from '../../lib/dates';
const statusLabels = {
  [adhesionEvidenceStatus.Valid]: 'Vigente para novas autorizações',
  [adhesionEvidenceStatus.Retracted]: 'Comprovação retirada',
  [adhesionEvidenceStatus.DocumentChanged]: 'Documento tem nova versão; confira novamente',
  [adhesionEvidenceStatus.DocumentWithdrawn]: 'Documento retirado; confira novamente',
} satisfies Record<AdhesionEvidence['status'], string>;
export function AdhesionEvidenceList({
  entries,
  disabled,
  onRetract,
}: {
  entries: AdhesionEvidence[];
  disabled: boolean;
  onRetract: (item: AdhesionEvidence) => void;
}) {
  return (
    <ol className="tw:my-3 tw:grid tw:list-none tw:gap-4 tw:p-0">
      {entries.map((item) => (
        <li
          key={item.id}
          className="tw:grid tw:gap-2 tw:border-t tw:border-border-default tw:pt-3 tw:wrap-anywhere"
        >
          <strong>
            {item.reference.evidenceReference} · {statusLabels[item.status]}
          </strong>
          <p className="tw:m-0">{item.reviewNote}</p>
          <p className="tw:m-0 tw:text-caption">
            {item.document
              ? `Arquivo conferido: ${item.document.file.fileName} · versão ${item.document.version}`
              : 'Conferência por referência externa, sem anexo'}
          </p>
          <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
            Admin demonstrativo · {formatServerInstant(item.recordedAt)}
          </p>
          {item.retraction && (
            <p className="tw:m-0">
              Retirada: {item.retraction.reason} · Admin demonstrativo ·{' '}
              {formatServerInstant(item.retraction.recordedAt)}
            </p>
          )}
          {!item.retraction && (
            <Button
              className="tw:justify-self-start"
              variant="secondary"
              disabled={disabled}
              aria-label={`Retirar comprovação de ${item.reference.evidenceReference}`}
              onClick={() => onRetract(item)}
            >
              Retirar comprovação
            </Button>
          )}
        </li>
      ))}
    </ol>
  );
}
