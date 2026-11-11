import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { type AdminReadService } from '../../../../api/admin/workspace/admin-read';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';
import { Panel } from '../../../../components/ds/panel/Panel';
import { ActionForm } from '../../../../components/workspace/ActionForm';
import { WorkspacePagination } from '../../../../components/workspace/WorkspacePagination';
import { formatServerInstant } from '../../../../lib/dates';

export function SatisfactionRequestsPanel({
  service,
  company,
  month,
  actor,
  canClose,
}: {
  service: AdminReadService;
  company: string | null;
  month: string | null;
  actor?: string;
  canClose: boolean;
}) {
  const [page, setPage] = useState(1);
  const cache = useQueryClient();
  const key = ['satisfaction-requests', actor];
  const result = useQuery({
    queryKey: [...key, company, month, page],
    queryFn: actor
      ? ({ signal }) => service.satisfactionRequests(company, month, page, signal)
      : skipToken,
  });
  const data = result.data;
  return (
    <Panel aria-labelledby="satisfaction-requests-title" className="tw:grid tw:gap-4">
      <h2 id="satisfaction-requests-title" className="tw:m-0 tw:text-section tw:font-bold">
        Respostas às avaliações de ocorrências
      </h2>
      {result.isPending && <FeedbackState kind="loading">Consultando solicitações…</FeedbackState>}
      {result.isError && (
        <FeedbackState kind="error" onRetry={() => void result.refetch()}>
          Não foi possível consultar as solicitações de avaliação.
        </FeedbackState>
      )}
      {data === null && (
        <p className="tw:m-0">Histórico de solicitações indisponível neste ambiente.</p>
      )}
      {data && (
        <>
          <dl className="tw:m-0 tw:grid tw:grid-cols-2 tw:gap-3 tw:wide:grid-cols-3">
            {(
              [
                ['Respondidas', data.answered],
                ['Aguardando resposta', data.waiting],
                ['Sem resposta', data.unanswered],
              ] as const
            ).map(([label, total]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd className="tw:m-0 tw:text-section tw:font-bold tw:text-brand">{total}</dd>
              </div>
            ))}
          </dl>
          <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
            Contagem por ocorrência com data de solicitação registrada. O período usa a data da
            solicitação.
          </p>
          {company && data.waiting > 0 && (
            <>
              <ul className="tw:m-0 tw:grid tw:list-none tw:gap-3 tw:p-0">
                {data.requests.map((request) => (
                  <li
                    key={request.id}
                    className="tw:grid tw:gap-1 tw:border-t tw:border-border-default tw:pt-3"
                  >
                    <strong>{request.title}</strong>
                    <span>{formatServerInstant(request.requestedAt)}</span>
                    {canClose && (
                      <ActionForm
                        label="Confirmar encerramento"
                        dialog={{
                          title: 'Registrar ausência de resposta',
                          trigger: 'Marcar sem resposta',
                        }}
                        submit={async () => {
                          await service.closeSatisfactionRequest(company, request);
                          if (page > 1 && data.requests.length === 1) setPage(page - 1);
                          await cache.invalidateQueries({ queryKey: key });
                        }}
                      >
                        {() => (
                          <p>
                            Marcar a avaliação de “{request.title}” como sem resposta? Se chegar uma
                            avaliação depois, ela será contabilizada como respondida.
                          </p>
                        )}
                      </ActionForm>
                    )}
                  </li>
                ))}
              </ul>
              <WorkspacePagination total={data.waiting} page={page} change={setPage} />
            </>
          )}
        </>
      )}
    </Panel>
  );
}
