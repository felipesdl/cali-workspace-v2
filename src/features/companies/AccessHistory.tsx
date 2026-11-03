import { useCompanyAccessHistory } from '../../api/modules/companies/hooks/useCompanyManagement';
import { type CompanyAccessEvent } from '../../api/modules/companies/management-schemas';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { formatServerInstant } from '../../lib/dates';

const actionLabels = {
  authorized: 'Autorização registrada',
  renamed: 'Nome alterado',
  revoked: 'Autorização revogada',
  reauthorized: 'Autorização restabelecida',
} satisfies Record<CompanyAccessEvent['action'], string>;
export function AccessHistory({ companyId }: { companyId: string }) {
  const history = useCompanyAccessHistory(companyId);
  return (
    <details className="tw:mt-5">
      <summary className="tw:cursor-pointer tw:font-semibold tw:text-brand">
        Histórico dos acessos
      </summary>
      {history.isPending && <FeedbackState kind="loading">Carregando histórico…</FeedbackState>}
      {history.isError && (
        <FeedbackState
          kind="error"
          retryVariant="secondary"
          retryLabel="Recarregar histórico"
          onRetry={() => void history.refetch()}
        >
          Não foi possível carregar o histórico.
        </FeedbackState>
      )}
      {history.isSuccess &&
        (history.data.length === 0 ? (
          <FeedbackState kind="empty">
            Nenhuma alteração registrada nesta demonstração.
          </FeedbackState>
        ) : (
          <ol className="tw:grid tw:gap-3 tw:pl-5 tw:[&_li]:wrap-anywhere">
            {[...history.data].reverse().map((item) => (
              <li key={item.id}>
                <strong>
                  {actionLabels[item.action]} · {item.current.name}
                </strong>
                <div>{item.current.email}</div>
                {item.action === 'renamed' && item.previous && (
                  <div>Nome anterior: {item.previous.name}</div>
                )}
                <div className="tw:text-caption tw:text-muted-copy">
                  Admin demonstrativo · {formatServerInstant(item.recordedAt)}
                </div>
              </li>
            ))}
          </ol>
        ))}
    </details>
  );
}
