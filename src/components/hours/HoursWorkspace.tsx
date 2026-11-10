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

function HourCapacity({
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
  return (
    <section className={panel}>
      <h2 className="tw:font-semibold">Capacidade do mês</h2>
      <dl className="tw:mt-2 tw:grid tw:gap-2 tw:wide:grid-cols-2">
        <div>
          <dt>Franquia contratada</dt>
          <dd>
            {contractedMinutes === null ? (
              'Sem franquia definida'
            ) : (
              <Minutes value={contractedMinutes} />
            )}
          </dd>
        </div>
        <div>
          <dt>Consumo operacional</dt>
          <dd>
            <Minutes value={consumedMinutes} />
          </dd>
        </div>
        {remainingMinutes !== null && (
          <div>
            <dt>Saldo disponível</dt>
            <dd>
              <Minutes value={remainingMinutes} />
            </dd>
          </div>
        )}
        {overMinutes !== null && overMinutes > 0 && (
          <div>
            <dt>Excedente</dt>
            <dd>
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
          <section className={`${panel} tw:wrap-anywhere`}>
            <h2 className="tw:font-semibold">Extrato de atuação</h2>
            <p>
              Total dos lançamentos exibíveis no mês: <Minutes value={result.data.minutes} />
            </p>
            {result.data.entries.length ? (
              <ul className="tw:my-4 tw:grid tw:gap-3">
                {result.data.entries.map((entry) => (
                  <li key={entry.id}>
                    <strong>{entry.description}</strong>
                    <p>
                      {formatCalendarDate(entry.work_date)} · <Minutes value={entry.minutes} />
                      {entry.category && ` · ${entry.category}`}
                    </p>
                    {admin && entry.internal_note && <p>Nota interna: {entry.internal_note}</p>}
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
