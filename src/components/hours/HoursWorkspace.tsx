import { Minutes } from './Minutes';
import { MonthSelect } from '../workspace/WorkspaceMonthSelect';
import { HourActions, HourCapacityAction, HourEntryCorrection } from './HourActions';
import { CapacityMilestones } from './CapacityMilestones';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useProjectWorkspaceScope } from '../workspace/useProjectWorkspaceScope';
import { FeedbackState } from '../ds/feedback/FeedbackState';
import { currentBrasiliaMonth, formatCalendarDate } from '../../lib/dates';
import { ClientModulePending } from '../workspace/ClientModulePending';
import { CompanySelect } from '../workspace/WorkspaceCompanySelect';
import { Pages } from '../workspace/WorkspacePages';
import { panel } from '../workspace/workspace-presentation';
import { type Props } from '../workspace/workspace-presentation';

export function HourCapacity({
  contractedMinutes,
  consumedMinutes,
  remainingMinutes,
  overMinutes,
}: {
  contractedMinutes: number | null;
  consumedMinutes: number;
  remainingMinutes: number | null;
  overMinutes: number | null;
}) {
  const usagePercent =
    contractedMinutes !== null && contractedMinutes > 0
      ? (consumedMinutes / contractedMinutes) * 100
      : null;
  return (
    <section
      className={`${panel} tw:grid tw:min-w-0 tw:gap-4 tw:border-t-[3px] tw:border-t-brand tw:wide:p-6`}
    >
      <header className="tw:grid tw:gap-1">
        <p className="tw:m-0 tw:text-caption tw:font-semibold tw:tracking-wide tw:text-muted-copy">
          CICLO · CAPACIDADE
        </p>
        <h2 className="tw:m-0 tw:text-section tw:font-bold tw:text-brand">Capacidade do mês</h2>
      </header>
      {usagePercent !== null && (
        <div className="tw:grid tw:gap-2">
          <p className="tw:m-0 tw:text-body tw:font-semibold">
            {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(usagePercent)}% da
            franquia consumida
          </p>
          <progress
            className="tw:w-full tw:accent-brand"
            aria-label="Consumo da capacidade mensal contratada"
            aria-valuetext={`${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(usagePercent)}% consumido`}
            value={Math.min(usagePercent, 100)}
            max={100}
          />
        </div>
      )}
      <dl className="tw:m-0 tw:grid tw:gap-2 tw:wide:grid-cols-2">
        <div className="tw:grid tw:gap-1 tw:rounded-control tw:border tw:border-border-default tw:p-3">
          <dt className="tw:text-caption tw:text-muted-copy">Franquia contratada</dt>
          <dd className="tw:m-0 tw:text-body tw:font-semibold tw:text-brand">
            {contractedMinutes === null ? (
              'Sem franquia definida'
            ) : (
              <Minutes value={contractedMinutes} />
            )}
          </dd>
        </div>
        <div className="tw:grid tw:gap-1 tw:rounded-control tw:border tw:border-border-default tw:p-3">
          <dt className="tw:text-caption tw:text-muted-copy">Consumo operacional</dt>
          <dd className="tw:m-0 tw:text-body tw:font-semibold tw:text-brand">
            <Minutes value={consumedMinutes} />
          </dd>
        </div>
        {remainingMinutes !== null && (
          <div className="tw:grid tw:gap-1 tw:rounded-control tw:border tw:border-border-default tw:p-3">
            <dt className="tw:text-caption tw:text-muted-copy">Saldo disponível</dt>
            <dd className="tw:m-0 tw:text-body tw:font-semibold tw:text-brand">
              <Minutes value={remainingMinutes} />
            </dd>
          </div>
        )}
        {overMinutes !== null && overMinutes > 0 && (
          <div className="tw:grid tw:gap-1 tw:rounded-control tw:border tw:border-feedback-error-border tw:bg-feedback-error-surface tw:p-3">
            <dt className="tw:text-feedback-error-text tw:text-caption">Excedente</dt>
            <dd className="tw:text-feedback-error-text tw:m-0 tw:text-body tw:font-semibold">
              <Minutes value={overMinutes} />
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

export function Hours({ search, update }: Props) {
  const { service, actor, companyId, admin } = useProjectWorkspaceScope(search);
  const month = search.month ?? currentBrasiliaMonth();
  const result = useQuery({
    queryKey: ['hours', actor, companyId, month, search.page],
    queryFn:
      service && companyId
        ? ({ signal }) => service.hours(companyId, month, search.page, signal)
        : skipToken,
  });
  if (!service) return admin ? null : <ClientModulePending />;
  return (
    <div className="tw:grid tw:gap-4">
      {admin && <CompanySelect search={search} update={update} />}
      <MonthSelect month={month} update={update} />
      {admin && companyId && (
        <HourActions
          key={companyId}
          company={companyId}
          actor={actor}
          delivery={search.delivery}
          task={search.task}
        />
      )}
      {!companyId ? (
        <FeedbackState kind="empty">
          {admin ? 'Selecione uma empresa.' : 'Horas indisponíveis para esta empresa.'}
        </FeedbackState>
      ) : result.isPending ? (
        <FeedbackState kind="loading">Carregando extrato…</FeedbackState>
      ) : result.isError ? (
        <FeedbackState kind="error" onRetry={() => void result.refetch()}>
          Não foi possível consultar o extrato.
        </FeedbackState>
      ) : result.data.visible ? (
        <>
          {result.data.capacity && <HourCapacity {...result.data.capacity} />}
          {result.data.capacityHistory && (
            <CapacityMilestones history={result.data.capacityHistory} />
          )}
          {admin &&
            result.data.capacityHistory &&
            result.data.capacityControl &&
            (result.data.capacityHistory.paused || result.data.capacityControl.canPause) && (
              <HourCapacityAction
                key={result.data.capacityControl.version ?? month}
                company={companyId}
                actor={actor}
                month={month}
                version={result.data.capacityControl.version}
                paused={result.data.capacityHistory.paused}
              />
            )}
          <section className={`${panel} tw:grid tw:min-w-0 tw:gap-3 tw:wrap-anywhere tw:wide:p-6`}>
            <header className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2 tw:border-b tw:border-border-default tw:pb-3">
              <div className="tw:grid tw:gap-1">
                <h2 className="tw:m-0 tw:text-body tw:font-bold tw:text-brand">
                  Extrato de atuação
                </h2>
                <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
                  Total dos lançamentos exibíveis no mês
                </p>
              </div>
              <strong className="tw:text-section tw:text-brand">
                <Minutes value={result.data.minutes} />
              </strong>
            </header>
            {result.data.entries.length ? (
              <ul className="tw:m-0 tw:grid tw:list-none tw:divide-y tw:divide-border-default tw:p-0">
                {result.data.entries.map((entry) => (
                  <li key={entry.id} className="tw:grid tw:min-w-0 tw:gap-2 tw:py-4">
                    <div className="tw:flex tw:min-w-0 tw:flex-wrap tw:items-start tw:justify-between tw:gap-2">
                      <strong className="tw:min-w-0 tw:flex-1 tw:wrap-anywhere">
                        {entry.description}
                      </strong>
                      <strong className="tw:shrink-0 tw:text-brand">
                        <Minutes value={entry.minutes} />
                      </strong>
                    </div>
                    <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
                      {formatCalendarDate(entry.work_date)}
                      {entry.category && ` · ${entry.category}`}
                    </p>
                    {admin && entry.internal_note && (
                      <p className="tw:m-0 tw:rounded-control tw:bg-ivory tw:p-3 tw:text-caption">
                        Nota interna: {entry.internal_note}
                      </p>
                    )}
                    {admin && entry.editVersion && (
                      <HourEntryCorrection
                        company={companyId}
                        actor={actor}
                        entry={entry.id}
                        version={entry.editVersion}
                        day={entry.work_date}
                        minutes={entry.minutes}
                        description={entry.description}
                        visible={Boolean(entry.clientVisible)}
                      />
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <FeedbackState kind="empty">Nenhum lançamento nesta página.</FeedbackState>
            )}
            <Pages total={result.data.total} search={search} update={update} />
          </section>
        </>
      ) : (
        <FeedbackState kind="empty">
          A consulta de horas está indisponível neste período.
        </FeedbackState>
      )}
    </div>
  );
}
