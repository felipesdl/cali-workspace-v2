import { useState } from 'react';
import { serviceCycleStatus, type ServiceCycleStatus } from '../../api/modules/companies/cycles';
import { isPilotCompany } from '../../api/modules/companies/onboarding';
import { useCompanyCyclesQuery } from '../../api/modules/companies/hooks/useCompanyCyclesQuery';
import { Button } from '../../components/ds/button/Button';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { ServiceCycleAction } from './ServiceCycleAction';

const labels = {
  [serviceCycleStatus.Planned]: 'Planejado',
  [serviceCycleStatus.Open]: 'Aberto',
  [serviceCycleStatus.Review]: 'Em revisão',
  [serviceCycleStatus.Closed]: 'Encerrado',
} satisfies Record<ServiceCycleStatus, string>;

const hoursFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const monthFormat = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function CompanyCycles({ companyId }: { companyId: string }) {
  const { available, query, open, canOpen, canTransition } = useCompanyCyclesQuery(companyId);
  const [confirm, setConfirm] = useState(false);
  if (!available) return null;

  return (
    <section
      aria-labelledby="company-cycles-title"
      className="tw:grid tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4"
    >
      <h2 id="company-cycles-title" className="tw:m-0 tw:text-section tw:font-bold tw:text-brand">
        Ciclos de serviço
      </h2>
      <p className="tw:m-0">Até 12 ciclos recentes da empresa.</p>
      {import.meta.env.DEV && canOpen && isPilotCompany(companyId) && (
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          {confirm ? (
            <>
              <Button
                pending={open.isPending}
                onClick={() => open.mutate(companyId, { onSuccess: () => setConfirm(false) })}
              >
                Confirmar abertura do mês
              </Button>
              <Button
                variant="secondary"
                disabled={open.isPending}
                onClick={() => setConfirm(false)}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              onClick={() => {
                open.reset();
                setConfirm(true);
              }}
            >
              Abrir ciclo do mês
            </Button>
          )}
        </div>
      )}
      {open.isError && <FeedbackState kind="error">{open.error.message}</FeedbackState>}
      {query.isPending && <FeedbackState kind="loading">Carregando ciclos…</FeedbackState>}
      {query.isError && (
        <FeedbackState kind="error">
          Não foi possível consultar os ciclos desta empresa.
        </FeedbackState>
      )}
      {query.isSuccess && query.data.length === 0 && (
        <FeedbackState kind="empty">Nenhum ciclo cadastrado nesta empresa.</FeedbackState>
      )}
      {query.isSuccess && query.data.length > 0 && (
        <ul className="tw:m-0 tw:grid tw:list-none tw:gap-3 tw:p-0">
          {query.data.map((cycle) => (
            <li
              key={cycle.id}
              className="tw:flex tw:flex-wrap tw:items-baseline tw:justify-between tw:gap-x-4 tw:gap-y-1 tw:border-b tw:border-border-default tw:pb-2"
            >
              <strong>{monthFormat.format(new Date(cycle.month))}</strong>
              <span>{labels[cycle.status]}</span>
              <span>
                {cycle.hours === null
                  ? 'Horas não informadas'
                  : `${hoursFormat.format(cycle.hours)} h`}
              </span>
              {import.meta.env.DEV && canTransition && isPilotCompany(companyId) && (
                <ServiceCycleAction key={cycle.status} companyId={companyId} cycle={cycle} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
