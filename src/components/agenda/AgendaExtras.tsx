import { useState } from 'react';
import { skipToken, useQuery } from '@tanstack/react-query';
import { type AgendaOperations } from '../../api/shared/workspace/agenda';
import { FeedbackState } from '../ds/feedback/FeedbackState';
import { formatServerInstant } from '../../lib/dates';
import { WorkspacePagination } from '../workspace/WorkspacePagination';
import { appointmentStatusLabel } from '../workspace/workspace-labels';
import { ActionForm } from '../workspace/ActionForm';
import { Checkbox } from '../ds/checkbox/Checkbox';
import { AgendaExtraActions } from './AgendaExtraActions';
import { AgendaExtraAdmin } from './AgendaExtraAdmin';
import { AgendaExtraRequest } from './AgendaExtraRequest';
import { Button } from '../ds/button/Button';

const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function AgendaExtras({
  company,
  actor,
  agenda,
}: {
  company: string;
  actor?: string;
  agenda: AgendaOperations;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [calendarFeedback, setCalendarFeedback] = useState<
    Record<string, { tone: 'success' | 'error'; message: string; meetingUrl?: string }>
  >({});
  const result = useQuery({
    queryKey: ['phase4-agenda-extras', actor, company, page],
    queryFn: open ? ({ signal }) => agenda.listExtras(company, page, signal) : skipToken,
  });
  async function syncExtra(appointmentId: string, cancelled = false) {
    if (!agenda.calendarSyncEnabled) return;
    setCalendarFeedback((previous) => ({
      ...previous,
      [appointmentId]: { tone: 'success', message: 'Sincronizando com Google Calendar…' },
    }));
    try {
      const integration = cancelled
        ? await agenda.syncCancelledExtraCalendar(appointmentId)
        : await agenda.syncConfirmedCalendar(appointmentId);
      const synced = integration.status === 'synced' || integration.status === 'cancelled_google';
      setCalendarFeedback((previous) => ({
        ...previous,
        [appointmentId]: {
          tone: synced ? 'success' : 'error',
          message: synced
            ? cancelled
              ? 'Cancelamento atualizado no Google Calendar.'
              : 'Evento sincronizado no Google Calendar.'
            : integration.status === 'busy'
              ? 'Outra sincronização está em andamento. Tente novamente em instantes.'
              : 'Visita preservada no CALI. Google Calendar ainda não confirmou a sincronização.',
          meetingUrl: integration.meetingUrl ?? undefined,
        },
      }));
    } catch {
      setCalendarFeedback((previous) => ({
        ...previous,
        [appointmentId]: {
          tone: 'error',
          message: 'Visita preservada no CALI. Google Calendar não sincronizou; tente novamente.',
        },
      }));
    }
    await result.refetch();
  }
  return (
    <details
      className="tw:min-w-0 tw:rounded-control tw:border tw:border-border-default tw:p-4 tw:wrap-anywhere"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Encontros adicionais</summary>
      {result.isPending && <FeedbackState kind="loading">Carregando encontros…</FeedbackState>}
      {result.isError && (
        <FeedbackState kind="error" onRetry={() => void result.refetch()}>
          Não foi possível consultar os encontros adicionais.
        </FeedbackState>
      )}
      {result.data?.entries.length === 0 && (
        <FeedbackState kind="empty">Nenhum encontro adicional nesta página.</FeedbackState>
      )}
      {result.data && (
        <>
          {result.data.canRequest && (
            <AgendaExtraRequest
              company={company}
              agenda={agenda}
              refresh={async () => {
                setPage(1);
                await result.refetch();
              }}
            />
          )}
          <ul className="tw:my-3 tw:grid tw:list-none tw:gap-3 tw:p-0">
            {result.data.entries.map((item) => (
              <li
                key={item.id}
                className="tw:rounded-control tw:border tw:border-border-default tw:p-3"
              >
                <strong>{item.title}</strong>
                <p>
                  {item.mode === 'in_person' ? 'Visita presencial' : 'Encontro online'} ·{' '}
                  {appointmentStatusLabel(item.status)}
                </p>
                <p>Pedido em {formatServerInstant(item.requestedAt)}</p>
                {item.amountCents !== null && (
                  <p>Valor registrado {reais.format(item.amountCents / 100)}</p>
                )}
                {item.acceptedAt && (
                  <p>Aceite registrado em {formatServerInstant(item.acceptedAt)}</p>
                )}
                {item.cancellationCents !== null && (
                  <p>
                    Taxa de cancelamento registrada {reais.format(item.cancellationCents / 100)}
                  </p>
                )}
                {item.quoteVersion && (
                  <ActionForm
                    label="Aceitar orçamento"
                    submit={async (fields) => {
                      if (!fields.has('confirmed')) throw new Error('Confirme o aceite do valor.');
                      const saved = await agenda.acceptOnlineQuote(
                        company,
                        item.id,
                        item.quoteVersion ?? '',
                      );
                      await result.refetch();
                      return saved;
                    }}
                  >
                    {() => (
                      <>
                        {item.quoteTerms && <p>{item.quoteTerms}</p>}
                        <Checkbox name="confirmed" required>
                          Confirmo o valor e as condições deste orçamento.
                        </Checkbox>
                      </>
                    )}
                  </ActionForm>
                )}
                <AgendaExtraAdmin
                  item={item}
                  company={company}
                  agenda={agenda}
                  refresh={async () => {
                    await result.refetch();
                  }}
                />
                <AgendaExtraActions
                  item={item}
                  company={company}
                  agenda={agenda}
                  syncAfterConfirmed={() => syncExtra(item.id)}
                  syncAfterCancelled={() => syncExtra(item.id, true)}
                  refresh={async () => {
                    await result.refetch();
                  }}
                />
                {item.status === 'confirmed' && agenda.calendarSyncEnabled && (
                  <Button variant="secondary" onClick={() => void syncExtra(item.id)}>
                    Tentar sincronização Google
                  </Button>
                )}
                {calendarFeedback[item.id]?.tone === 'error' &&
                  agenda.calendarSyncEnabled &&
                  item.status !== 'confirmed' && (
                    <Button
                      variant="secondary"
                      onClick={() => void syncExtra(item.id, true)}
                    >
                      Tentar atualizar cancelamento no Google
                    </Button>
                  )}
                {calendarFeedback[item.id] && (
                  <p role={calendarFeedback[item.id].tone === 'error' ? 'alert' : 'status'}>
                    {calendarFeedback[item.id].message}
                    {calendarFeedback[item.id].meetingUrl && (
                      <>
                        {' '}
                        <a
                          href={calendarFeedback[item.id].meetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Abrir Meet
                        </a>
                      </>
                    )}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <WorkspacePagination total={result.data.total} page={page} change={setPage} />
        </>
      )}
    </details>
  );
}
