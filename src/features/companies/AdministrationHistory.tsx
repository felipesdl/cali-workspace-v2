import { formatAdministrationValue } from './administration-presentation';
import { useAdministrationHistory } from '../../api/modules/companies/hooks/useCompanyManagement';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { formatServerInstant } from '../../lib/dates';
import { administrationGroups } from './administration-fields';

export function AdministrationHistory({ companyId }: { companyId: string }) {
  const history = useAdministrationHistory(companyId);
  return (
    <details className="tw:mt-4">
      <summary className="tw:cursor-pointer tw:font-semibold tw:text-brand">
        Histórico da ficha administrativa
      </summary>
      {history.isPending && (
        <FeedbackState kind="loading">Carregando histórico da ficha…</FeedbackState>
      )}
      {history.isError && (
        <FeedbackState
          kind="error"
          retryVariant="secondary"
          retryLabel="Recarregar histórico da ficha"
          onRetry={() => void history.refetch()}
        >
          Não foi possível carregar o histórico da ficha.
        </FeedbackState>
      )}
      {history.isSuccess && history.data.length === 0 && (
        <FeedbackState kind="empty">Nenhuma alteração registrada na ficha.</FeedbackState>
      )}
      {history.data && (
        <ol className="tw:grid tw:gap-3 tw:pl-5 tw:[&_li]:wrap-anywhere">
          {[...history.data].reverse().map((event) => {
            const changed = administrationGroups.flatMap((group) =>
              group.fields.filter(
                (field) => event.previous.values[field.name] !== event.current.values[field.name],
              ),
            );
            return (
              <li key={event.id}>
                <strong>Ficha administrativa · revisão {event.current.revision}</strong>
                <details className="tw:my-2">
                  <summary className="tw:cursor-pointer">
                    Consultar alterações da revisão {event.current.revision}
                  </summary>
                  <dl className="tw:mt-3 tw:grid tw:gap-3 tw:[&_dd]:m-0 tw:[&_dd]:wrap-anywhere tw:[&_dd]:whitespace-pre-wrap">
                    {changed.map((field) => (
                      <div key={field.name}>
                        <dt className="tw:font-semibold">{field.label}</dt>
                        <dd>Antes: {formatAdministrationValue(field, event.previous.values)}</dd>
                        <dd>Depois: {formatAdministrationValue(field, event.current.values)}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
                <p className="tw:my-1 tw:text-caption tw:text-muted-copy">
                  Admin demonstrativo · {formatServerInstant(event.recordedAt)}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </details>
  );
}
