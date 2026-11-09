import { useState } from 'react';
import { skipToken, useQuery } from '@tanstack/react-query';
import { type AgendaOperations } from '../../api/modules/project-workspace/agenda';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { formatServerInstant } from '../../lib/dates';
import { WorkspacePagination } from './WorkspacePagination';
import { appointmentStatusLabel } from './workspace-labels';
import { ActionForm } from './ActionForm';
import { Checkbox } from '../../components/ds/checkbox/Checkbox';
import { AgendaExtraActions } from './AgendaExtraActions';
import { AgendaExtraAdmin } from './AgendaExtraAdmin';
import { AgendaExtraRequest } from './AgendaExtraRequest';

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
  const result = useQuery({
    queryKey: ['phase4-agenda-extras', actor, company, page],
    queryFn: open ? ({ signal }) => agenda.listExtras(company, page, signal) : skipToken,
  });
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
                  refresh={async () => {
                    await result.refetch();
                  }}
                />
              </li>
            ))}
          </ul>
          <WorkspacePagination total={result.data.total} page={page} change={setPage} />
        </>
      )}
    </details>
  );
}
