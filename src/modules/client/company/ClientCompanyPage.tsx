import { companyStatus } from '../../../api/admin/companies/schemas';
import { useClientCompany } from '../../../api/client/company/useClientCompany';
import { FeedbackState } from '../../../components/ds/feedback/FeedbackState';
const eligibleStatus = [companyStatus.Active, companyStatus.Paused];
export function ClientCompanyPage() {
  const { query, enabled, revalidate } = useClientCompany();
  if (!enabled)
    return (
      <FeedbackState kind="error">
        Não foi possível confirmar o vínculo com sua empresa.
      </FeedbackState>
    );
  if (query.isPending)
    return <FeedbackState kind="loading">Carregando os dados da sua empresa…</FeedbackState>;
  if (query.isError)
    return (
      <FeedbackState kind="error" retryVariant="secondary" onRetry={() => void query.refetch()}>
        Não foi possível consultar os dados da sua empresa. Tente novamente.
      </FeedbackState>
    );
  if (!query.data)
    return (
      <FeedbackState
        kind="error"
        retryVariant="secondary"
        retryLabel="Revalidar acesso"
        onRetry={() => void revalidate()}
      >
        Os dados da empresa não estão disponíveis para este acesso. Revalide seu acesso; se
        persistir, entre em contato com a CALI.
      </FeedbackState>
    );
  const company = query.data;
  if (!eligibleStatus.some((status) => status === company.status))
    return (
      <FeedbackState
        kind="error"
        retryVariant="secondary"
        retryLabel="Revalidar acesso"
        onRetry={() => void revalidate()}
      >
        A consulta desta empresa está indisponível. Revalide seu acesso para continuar.
      </FeedbackState>
    );
  return (
    <section
      aria-label="Dados da minha empresa"
      aria-busy={query.isFetching}
      className="tw:grid tw:min-w-0 tw:gap-4"
    >
      <p className="tw:m-0">
        Consulte a identificação da empresa vinculada ao seu acesso. Para corrigir estes dados,
        entre em contato com a CALI.
      </p>
      <dl className="tw:m-0 tw:grid tw:grid-cols-2 tw:gap-4 tw:wrap-anywhere tw:mobile:grid-cols-1">
        <div>
          <dt className="tw:text-caption tw:text-muted-copy">Nome da empresa</dt>
          <dd className="tw:m-0 tw:font-semibold">{company.displayName}</dd>
        </div>
        <div>
          <dt className="tw:text-caption tw:text-muted-copy">Razão social</dt>
          <dd className="tw:m-0">{company.legalName || 'Não informada'}</dd>
        </div>
        <div>
          <dt className="tw:text-caption tw:text-muted-copy">Situação da conta</dt>
          <dd className="tw:m-0">
            {company.status === companyStatus.Paused ? 'Pausada' : 'Ativa'}
          </dd>
        </div>
      </dl>
      {company.status === companyStatus.Paused && (
        <p className="tw:m-0">Sua conta está pausada. A consulta permanece disponível.</p>
      )}
      <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
        A gestão cadastral, contratual e de acessos é realizada pela CALI.
      </p>
    </section>
  );
}
