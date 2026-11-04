import { useCompanyAccessesQuery } from '../../api/modules/companies/hooks/useCompanyAccessesQuery';
import { useCompanyQuery } from '../../api/modules/companies/hooks/useCompanyQuery';
import { Button } from '../../components/ds/button/Button';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { formatCalendarDate } from '../../lib/dates';
import { CompanyAccessManagement } from './CompanyAccessManagement';
import { PilotAccessAction } from './PilotAccessAction';
import { isPilotCompany } from '../../api/modules/companies/onboarding';

export function CompanyAccessPanel({
  companyId,
  canManage,
  onClose,
}: {
  companyId: string;
  canManage: boolean;
  onClose: () => void;
}) {
  const accesses = useCompanyAccessesQuery(companyId);
  const selectedCompany = useCompanyQuery(companyId);
  return (
    <section
      className="tw:min-w-0 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4"
      aria-labelledby="accesses-title"
      aria-busy={accesses.isFetching}
    >
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:mobile:flex-col tw:mobile:items-start">
        <div>
          <h2
            className="tw:m-0 tw:mb-3 tw:text-section tw:font-bold tw:text-action-primary"
            id="accesses-title"
          >
            Acessos{selectedCompany.data ? ` · ${selectedCompany.data.displayName}` : ''}
          </h2>
          <p>Até quatro acessos Cliente equivalentes por empresa.</p>
        </div>
        <Button variant="secondary" onClick={onClose}>
          Fechar acessos
        </Button>
      </div>
      {accesses.isPending && <FeedbackState kind="loading">Carregando acessos…</FeedbackState>}
      {accesses.isError && (
        <FeedbackState kind="error">
          Não foi possível carregar os acessos desta empresa.
        </FeedbackState>
      )}
      {accesses.isSuccess && canManage && (
        <CompanyAccessManagement key={companyId} companyId={companyId} accesses={accesses.data} />
      )}
      {accesses.isSuccess && !canManage && accesses.data.length === 0 && (
        <FeedbackState kind="empty">Nenhum acesso nesta empresa.</FeedbackState>
      )}
      {accesses.isSuccess && !canManage && accesses.data.length > 0 && (
        <ul className="tw:m-0 tw:mt-4 tw:grid tw:list-none tw:gap-3 tw:p-0 tw:[&_li]:grid tw:[&_li]:gap-1 tw:[&_li]:border-b tw:[&_li]:border-border-default tw:[&_li]:py-3 tw:[&_li]:wrap-anywhere tw:[&_li_span]:text-caption tw:[&_li_span]:text-muted-copy">
          {accesses.data.map((access) => (
            <li key={access.id}>
              <strong>{access.name}</strong>
              <span>{access.email}</span>
              <span>
                {access.status === 'active' ? 'Ativo' : 'Revogado'} · Convite em{' '}
                {access.invitedOn ? formatCalendarDate(access.invitedOn) : 'não enviado'}
              </span>
            </li>
          ))}
        </ul>
      )}
      {import.meta.env.DEV && isPilotCompany(companyId) && accesses.isSuccess && (
        <PilotAccessAction key={companyId} companyId={companyId} />
      )}
    </section>
  );
}
