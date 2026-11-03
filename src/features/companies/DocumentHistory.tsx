import { useDocumentHistory } from '../../api/modules/companies/hooks/useCompanyManagement';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { formatServerInstant } from '../../lib/dates';
const labels = {
  attached: 'Arquivo anexado',
  version_added: 'Nova versão anexada',
  withdrawn: 'Documento retirado',
} as const;
export function DocumentHistory({ companyId }: { companyId: string }) {
  const history = useDocumentHistory(companyId);
  return (
    <details className="tw:mt-4">
      <summary className="tw:cursor-pointer tw:font-semibold tw:text-brand">
        Histórico dos arquivos
      </summary>
      {history.isPending && (
        <FeedbackState kind="loading">Carregando histórico dos arquivos…</FeedbackState>
      )}
      {history.isError && (
        <FeedbackState kind="error" retryVariant="secondary" onRetry={() => void history.refetch()}>
          Não foi possível carregar o histórico dos arquivos.
        </FeedbackState>
      )}
      {history.isSuccess && history.data.length === 0 && (
        <FeedbackState kind="empty">Nenhum arquivo registrado nesta demonstração.</FeedbackState>
      )}
      {history.data && (
        <ol className="tw:grid tw:gap-3 tw:pl-5">
          {[...history.data].reverse().map((event) => (
            <li key={event.id}>
              <strong>{labels[event.action]}</strong>
              {event.reason && <p className="tw:my-1 tw:wrap-anywhere">{event.reason}</p>}
              <p className="tw:my-1 tw:text-caption tw:text-muted-copy">
                Admin demonstrativo · {formatServerInstant(event.recordedAt)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}
