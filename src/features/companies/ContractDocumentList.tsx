import { type CompanyDocument } from '../../api/modules/companies/document-schemas';
import { type useDocumentDownload } from './hooks/useDocumentDownload';
import { Button } from '../../components/ds/button/Button';
import { formatCalendarDate, formatServerInstant } from '../../lib/dates';
function Version({
  entry,
  download,
}: {
  entry: CompanyDocument;
  download: ReturnType<typeof useDocumentDownload>;
}) {
  return (
    <div className="tw:grid tw:gap-2 tw:wrap-anywhere">
      <strong>
        {entry.file.fileName} · versão {entry.version}
      </strong>
      <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
        {entry.documentDate
          ? `Data do documento: ${formatCalendarDate(entry.documentDate)}`
          : 'Data do documento não informada'}{' '}
        · {new Intl.NumberFormat('pt-BR').format(entry.file.bytes)} bytes
      </p>
      <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
        Admin demonstrativo · {formatServerInstant(entry.recordedAt)}
      </p>
      <Button
        variant="secondary"
        className="tw:justify-self-start"
        disabled={download.pending}
        aria-label={`Baixar ${entry.file.fileName}, versão ${entry.version}`}
        onClick={() => void download.run(entry)}
      >
        Baixar arquivo
      </Button>
    </div>
  );
}
export function ContractDocumentList({
  entries,
  download,
  onVersion,
  onWithdraw,
  actionsDisabled,
}: {
  actionsDisabled: boolean;
  entries: CompanyDocument[];
  download: ReturnType<typeof useDocumentDownload>;
  onVersion: (entry: CompanyDocument) => void;
  onWithdraw: (entry: CompanyDocument) => void;
}) {
  return (
    <ul className="tw:m-0 tw:list-none tw:p-0">
      {entries
        .filter((item) => item.isCurrent)
        .map((entry) => (
          <li
            key={entry.documentId}
            className="tw:grid tw:gap-3 tw:border-b tw:border-border-default tw:py-4"
          >
            <h3 className="tw:m-0 tw:text-body tw:font-semibold tw:text-brand">
              {entry.documentType === 'contract' ? 'Contrato' : 'Aditivo contratual'}
              {entry.withdrawn ? ' · Retirado' : ' · Versão corrente'}
            </h3>
            <Version entry={entry} download={download} />
            {entry.withdrawn ? (
              <p className="tw:my-1 tw:wrap-anywhere">
                Motivo da retirada: {entry.withdrawalReason}
              </p>
            ) : (
              <div className="tw:flex tw:flex-wrap tw:gap-3">
                <Button
                  variant="secondary"
                  disabled={actionsDisabled}
                  aria-label={`Nova versão de ${entry.file.fileName}`}
                  onClick={() => onVersion(entry)}
                >
                  Anexar nova versão
                </Button>
                <Button
                  variant="secondary"
                  disabled={actionsDisabled}
                  aria-label={`Retirar ${entry.file.fileName}`}
                  onClick={() => onWithdraw(entry)}
                >
                  Retirar documento
                </Button>
              </div>
            )}
            <details>
              <summary className="tw:cursor-pointer">
                Versões anteriores de {entry.file.fileName}
              </summary>
              {entries
                .filter((item) => item.documentId === entry.documentId && !item.isCurrent)
                .map((item) => (
                  <div key={item.id} className="tw:mt-3">
                    <Version entry={item} download={download} />
                  </div>
                ))}
              {entry.version === 1 && <p>Nenhuma versão anterior.</p>}
            </details>
          </li>
        ))}
    </ul>
  );
}
