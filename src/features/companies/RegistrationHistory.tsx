import { useRegistrationHistory } from '../../api/modules/companies/hooks/useCompanyManagement';
import { registrationGroups } from './registration-fields';
import { formatRegistrationValue } from './registration-presentation';
import { LogoPreview } from './LogoPreview';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { formatServerInstant } from '../../lib/dates';
export function RegistrationHistory({ companyId }: { companyId: string }) {
  const history = useRegistrationHistory(companyId);
  return (
    <details className="tw:mt-4">
      <summary className="tw:cursor-pointer tw:font-semibold tw:text-brand">
        Histórico dos dados cadastrais
      </summary>
      {history.isPending && (
        <FeedbackState kind="loading">Carregando histórico cadastral…</FeedbackState>
      )}
      {history.isError && (
        <FeedbackState kind="error" retryVariant="secondary" onRetry={() => void history.refetch()}>
          Não foi possível carregar o histórico cadastral.
        </FeedbackState>
      )}
      {history.isSuccess && history.data.length === 0 && (
        <FeedbackState kind="empty">Nenhuma alteração cadastral registrada.</FeedbackState>
      )}
      {history.data && (
        <ol className="tw:grid tw:gap-3 tw:pl-5 tw:[&_li]:wrap-anywhere">
          {[...history.data].reverse().map((event) => {
            const changed = registrationGroups.flatMap((group) =>
              group.fields.filter(
                (field) =>
                  JSON.stringify(event.previous.values[field.name]) !==
                  JSON.stringify(event.current.values[field.name]),
              ),
            );
            const logoChanged =
              JSON.stringify(event.previous.values.logo) !==
              JSON.stringify(event.current.values.logo);
            return (
              <li key={event.id}>
                <strong>Cadastro da empresa · revisão {event.current.revision}</strong>
                <details className="tw:my-2">
                  <summary className="tw:cursor-pointer">
                    Consultar dados da revisão {event.current.revision}
                  </summary>
                  <dl className="tw:mt-3 tw:grid tw:gap-3 tw:[&_dd]:m-0 tw:[&_dd]:wrap-anywhere tw:[&_dd]:whitespace-pre-wrap">
                    {changed.map((field) => (
                      <div key={field.name}>
                        <dt className="tw:font-semibold">{field.label}</dt>
                        <dd>Antes: {formatRegistrationValue(field, event.previous.values)}</dd>
                        <dd>Depois: {formatRegistrationValue(field, event.current.values)}</dd>
                      </div>
                    ))}
                  </dl>
                  {logoChanged && (
                    <div className="tw:mt-3 tw:grid tw:grid-cols-2 tw:gap-3 tw:mobile:grid-cols-1">
                      <div>
                        <p>Logo anterior</p>
                        <LogoPreview
                          logo={event.previous.values.logo}
                          alt="Logo anterior da empresa"
                        />
                      </div>
                      <div>
                        <p>Logo registrada</p>
                        <LogoPreview
                          logo={event.current.values.logo}
                          alt="Logo registrada na revisão"
                        />
                      </div>
                    </div>
                  )}
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
