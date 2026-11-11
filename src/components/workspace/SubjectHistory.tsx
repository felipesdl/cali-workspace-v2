import { skipToken, useQuery } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { useState } from 'react';
import { formatCalendarDate, formatServerInstant } from '../../lib/dates';
import { FeedbackState } from '../ds/feedback/FeedbackState';
import { WorkspacePagination } from './WorkspacePagination';

export function SubjectHistory({
  company,
  actor,
  kind,
  id,
}: {
  company: string;
  actor?: string;
  kind: 'record' | 'delivery';
  id: string;
}) {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const { domainOperations } = useRouteContext({ from: '__root__' });
  const result = useQuery({
    queryKey: ['subject-history', actor, company, kind, id, page],
    queryFn:
      open && domainOperations
        ? ({ signal }) => domainOperations.subjectHistory(company, kind, id, page, signal)
        : skipToken,
  });
  if (!domainOperations) return null;
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Histórico de horas e aprovações</summary>
      {open && (
        <div className="tw:grid tw:gap-3 tw:pt-2">
          {result.isPending && <FeedbackState kind="loading">Consultando histórico…</FeedbackState>}
          {result.isError && (
            <FeedbackState kind="error" onRetry={() => void result.refetch()}>
              Não foi possível consultar o histórico deste assunto.
            </FeedbackState>
          )}
          {result.data === null && <p>Histórico indisponível neste ambiente.</p>}
          {result.data && (
            <>
              {result.data.total === 0 ? (
                <p>Nenhuma hora ou aprovação neste assunto.</p>
              ) : (
                <ul className="tw:m-0 tw:grid tw:list-none tw:gap-2 tw:p-0">
                  {result.data.entries.map((entry) => (
                    <li
                      key={entry.id}
                      className="tw:grid tw:gap-1 tw:border-t tw:border-border-default tw:pt-2"
                    >
                      <strong>{entry.title}</strong>
                      <span className="tw:text-caption tw:text-muted-copy">
                        {entry.kind === 'hours'
                          ? `${formatCalendarDate(entry.at)} · ${entry.minutes} min`
                          : formatServerInstant(entry.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <WorkspacePagination page={page} total={result.data.total} change={setPage} />
            </>
          )}
        </div>
      )}
    </details>
  );
}
