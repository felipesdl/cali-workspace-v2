import { useState } from 'react';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { type DailyPreview } from '../../../../api/admin/workspace/admin-read';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';
import { formatCalendarDate, formatServerInstant } from '../../../../lib/dates';

type PreviewBlock = DailyPreview['companies'][number]['client'];

function SummaryBlock({ title, block }: { title: string; block: PreviewBlock }) {
  if (!block.total) return null;
  return (
    <section aria-label={title} className="tw:grid tw:gap-2">
      <h4 className="tw:font-semibold">{title}</h4>
      <ul className="tw:grid tw:gap-2">
        {block.items.map((item) => (
          <li key={item.id}>
            <p>
              {formatServerInstant(item.at)} · {item.title}
            </p>
            {item.excerpt && <p>{item.excerpt}</p>}
            {item.link && <a href={item.link}>Abrir no Workspace</a>}
          </li>
        ))}
      </ul>
      {block.total > block.items.length && <p>e mais {block.total - block.items.length}</p>}
    </section>
  );
}

function formatMinutes(minutes: number) {
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function AdminDailyPreview({ actor }: { actor?: string }) {
  const { adminRead } = useRouteContext({ from: '__root__' });
  const [open, setOpen] = useState(false);
  const result = useQuery({
    queryKey: ['phase4-daily-preview', actor],
    queryFn: open && adminRead ? ({ signal }) => adminRead.dailyPreview(signal) : skipToken,
    staleTime: 0,
  });
  if (!adminRead) return null;
  const data = result.data;
  return (
    <details
      className="tw:min-w-0 tw:rounded-control tw:border tw:border-border-default tw:p-4 tw:wrap-anywhere"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="tw:cursor-pointer tw:font-semibold">Prévia do resumo diário</summary>
      {open && (
        <div className="tw:mt-3 tw:grid tw:gap-3">
          {result.isPending && <FeedbackState kind="loading">Carregando resumo…</FeedbackState>}
          {result.isError && (
            <FeedbackState kind="error" onRetry={() => void result.refetch()}>
              Não foi possível consultar o resumo.
            </FeedbackState>
          )}
          {data && !result.isError && (
            <>
              <p>
                {formatCalendarDate(data.day)} · consultado em {formatServerInstant(data.asOf)}
              </p>
              {data.companies.length === 0 ? (
                <FeedbackState kind="empty">Nenhuma atividade elegível hoje.</FeedbackState>
              ) : (
                <>
                  <p>
                    Cliente: {data.clientTotal} · CALI: {data.caliTotal} · Horas:{' '}
                    {formatMinutes(data.minutes)}
                  </p>
                  {data.companies.map((company) => (
                    <section
                      key={company.id}
                      className="tw:grid tw:gap-2 tw:border-t tw:border-border-default tw:pt-3"
                    >
                      <h3 className="tw:font-semibold">{company.name}</h3>
                      <SummaryBlock title="O cliente fez" block={company.client} />
                      <SummaryBlock title="A CALI fez" block={company.cali} />
                      <p>Horas: {formatMinutes(company.minutes)}</p>
                    </section>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </details>
  );
}
