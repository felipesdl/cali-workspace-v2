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
  service: Pick<AdminReadService, 'mapaJourneys'>;
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
  if (!entries.length)
    return <FeedbackState kind="empty">Nenhuma jornada nesta página.</FeedbackState>;
  return (
    <section className="tw:grid tw:gap-3" aria-label="Jornadas vinculadas">
      <p>
        {total} {total === 1 ? 'jornada vinculada' : 'jornadas vinculadas'}
      </p>
      <div
        role="region"
        aria-label="Tabela de jornadas"
        tabIndex={0}
        className="tw:min-w-0 tw:overflow-x-auto tw:focus-visible:outline-2 tw:focus-visible:outline-offset-3 tw:focus-visible:outline-focus tw:mobile:hidden"
      >
        <table className="tw:w-full tw:min-w-[48rem] tw:border-collapse tw:text-left tw:[&_:is(th,td)]:border-b tw:[&_:is(th,td)]:border-border-default tw:[&_:is(th,td)]:p-3">
          <caption className="tw:pb-2 tw:text-left tw:text-muted-copy">
            Jornada e acessos · página {page}
          </caption>
          <thead>
            <tr>
              <th scope="col">Acesso</th>
              <th scope="col">Último sinal</th>
              <th scope="col">Etapa</th>
              <th scope="col">Dispositivo</th>
              <th scope="col">Origem</th>
              <th scope="col">Cópias</th>
              <th scope="col">Situação</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{formatServerInstant(entry.accessedAt)}</td>
                <td>{formatServerInstant(entry.lastSeenAt)}</td>
                <td>
                  {entry.status === 'completed'
                    ? 'Diagnóstico enviado'
                    : entry.started
                      ? `Etapa ${Math.max(1, entry.step)} de 7`
                      : 'Só abriu'}
                </td>
                <td>{entry.device ?? 'Não informado'}</td>
                <td>{entry.referrer || 'Acesso direto'}</td>
                <td>{entry.copies}</td>
                <td>{labels[entry.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="tw:m-0 tw:hidden tw:list-none tw:gap-3 tw:p-0 tw:mobile:grid">
        {entries.map((entry) => (
          <li key={entry.id} className="tw:min-w-0 tw:border-b tw:border-border-default tw:pb-3">
            <div className="tw:flex tw:flex-wrap tw:items-baseline tw:justify-between tw:gap-2">
              <strong>{labels[entry.status]}</strong>
              <span className="tw:text-caption tw:text-muted-copy">
                {formatServerInstant(entry.accessedAt)}
              </span>
            </div>
            <dl className="tw:my-2 tw:grid tw:grid-cols-2 tw:gap-x-3 tw:gap-y-2 tw:wrap-anywhere">
              <div>
                <dt className="tw:text-caption tw:text-muted-copy">Último sinal</dt>
                <dd className="tw:m-0">{formatServerInstant(entry.lastSeenAt)}</dd>
              </div>
              <div>
                <dt className="tw:text-caption tw:text-muted-copy">Etapa</dt>
                <dd className="tw:m-0">
                  {entry.status === 'completed'
                    ? 'Diagnóstico enviado'
                    : entry.started
                      ? `Etapa ${Math.max(1, entry.step)} de 7`
                      : 'Só abriu'}
                </dd>
              </div>
              <div>
                <dt className="tw:text-caption tw:text-muted-copy">Dispositivo</dt>
                <dd className="tw:m-0">{entry.device ?? 'Não informado'}</dd>
              </div>
              <div>
                <dt className="tw:text-caption tw:text-muted-copy">Origem</dt>
                <dd className="tw:m-0">{entry.referrer || 'Acesso direto'}</dd>
              </div>
              <div>
                <dt className="tw:text-caption tw:text-muted-copy">Cópias</dt>
                <dd className="tw:m-0">{entry.copies}</dd>
              </div>
            </dl>
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
