import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type AdminReadService } from '../../../../api/admin/workspace/admin-read';
import { Button } from '../../../../components/ds/button/Button';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';
import { formatServerInstant } from '../../../../lib/dates';

const labels = { completed: 'Enviou', in_progress: 'Em andamento', abandoned: 'Abandonou' };

export function MapaJourneys({
  company,
  actor,
  service,
}: {
  company: string;
  actor?: string;
  service: AdminReadService;
}) {
  const [page, setPage] = useState(1);
  const result = useQuery({
    queryKey: ['phase4-mapa-journeys', actor, company, page],
    queryFn: ({ signal }) => service.mapaJourneys(company, page, signal),
    gcTime: 0,
  });
  if (result.isPending) return <FeedbackState kind="loading">Carregando jornadas…</FeedbackState>;
  if (result.isError)
    return (
      <FeedbackState kind="error" onRetry={() => void result.refetch()}>
        Não foi possível consultar a jornada.
      </FeedbackState>
    );
  const { entries, total } = result.data;
  if (!total)
    return <FeedbackState kind="empty">Nenhuma jornada vinculada à empresa.</FeedbackState>;
  return (
    <section className="tw:grid tw:gap-3" aria-label="Jornadas vinculadas">
      <p>
        {total} {total === 1 ? 'jornada vinculada' : 'jornadas vinculadas'}
      </p>
      <ul className="tw:grid tw:gap-2">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="tw:rounded-control tw:border tw:border-border-default tw:p-3"
          >
            <strong>{labels[entry.status]}</strong>
            <p>
              {entry.status === 'completed'
                ? 'Diagnóstico enviado'
                : entry.started
                  ? `Etapa ${Math.max(1, entry.step)} de 7`
                  : 'Só abriu'}
            </p>
            <p>
              Acesso em {formatServerInstant(entry.accessedAt)} · Último sinal{' '}
              {formatServerInstant(entry.lastSeenAt)}
            </p>
            <p>
              {entry.device ?? 'Dispositivo não informado'} · {entry.referrer || 'Acesso direto'} ·{' '}
              {entry.copies} cópia(s)
            </p>
          </li>
        ))}
      </ul>
      {(page > 1 || total > page * 25) && (
        <div className="tw:flex tw:gap-2">
          <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          <Button
            variant="secondary"
            disabled={total <= page * 25}
            onClick={() => setPage(page + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </section>
  );
}
