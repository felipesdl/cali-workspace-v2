import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PartnerPilot, PartnerReviewKind } from '../../api/modules/partner/pilot';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { Field } from '../../components/ds/field/Field';
import { ActionForm } from '../project-workspace/ActionForm';
import { WorkspacePagination } from '../project-workspace/WorkspacePagination';

const labels = { pending: 'Em análise', approved: 'Aprovada', returned: 'Devolvida' } as const;
const kinds = {
  deliverable: 'Revisão de entregável',
  record_close: 'Encerramento de ocorrência',
} satisfies Record<PartnerReviewKind, string>;

export function PartnerReviewRequest({
  api,
  company,
  kind,
  item,
  saved,
}: {
  api: PartnerPilot;
  company: string;
  kind: PartnerReviewKind;
  item: string;
  saved: () => void;
}) {
  const cache = useQueryClient();
  return (
    <details>
      <summary>
        {kind === 'deliverable' ? 'Enviar entregável para revisão' : 'Pedir encerramento à CALI'}
      </summary>
      <ActionForm
        label="Enviar solicitação"
        success="Solicitação enviada para revisão da CALI."
        saved={() => {
          void cache.invalidateQueries({ queryKey: ['partner-reviews'] });
          saved();
        }}
        submit={(values, request) =>
          api.submitReview(company, request, kind, item, String(values.get('note') ?? ''))
        }
      >
        {(id) => (
          <Field id={id + 'note'} label="Observação para a CALI">
            <textarea id={id + 'note'} name="note" maxLength={2000} rows={2} />
          </Field>
        )}
      </ActionForm>
    </details>
  );
}

export function PartnerReviewQueue({
  api,
  company,
  actor,
  admin,
}: {
  api: PartnerPilot;
  company: string;
  actor?: string;
  admin: boolean;
}) {
  const [page, setPage] = useState(1);
  const queue = useQuery({
    queryKey: ['partner-reviews', actor, company, admin, page],
    queryFn: ({ signal }) => api.reviews(company, admin, page, signal),
    refetchInterval: 30000,
  });
  return (
    <section className="tw:grid tw:min-w-0 tw:gap-3 tw:wrap-anywhere" aria-label="Revisões Partner">
      <h2 className="tw:text-section tw:font-semibold">Revisões Partner</h2>
      {queue.isPending && <FeedbackState kind="loading">Carregando revisões…</FeedbackState>}
      {queue.isError && (
        <FeedbackState kind="error" onRetry={() => void queue.refetch()}>
          Não foi possível consultar revisões.
        </FeedbackState>
      )}
      {queue.isSuccess && (
        <>
          {queue.data.rows.length === 0 && (
            <FeedbackState kind="empty">Nenhuma revisão nesta página.</FeedbackState>
          )}
          <ul className="tw:m-0 tw:grid tw:list-none tw:gap-3 tw:p-0">
            {queue.data.rows.map((row) => (
              <li
                key={row.id}
                className="tw:grid tw:gap-2 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-3"
              >
                <strong>{row.title}</strong>
                <p>
                  {kinds[row.kind]} · {labels[row.status]}
                </p>
                {row.note && <p>{row.note}</p>}
                {row.decision_note && <p>Resposta CALI: {row.decision_note}</p>}
                {admin && row.status === 'pending' && (
                  <ActionForm
                    label="Registrar decisão"
                    saved={() => void queue.refetch()}
                    submit={(values) =>
                      api.decideReview(
                        company,
                        row.id,
                        values.get('decision') === 'approve',
                        String(values.get('note') ?? ''),
                      )
                    }
                  >
                    {(id) => (
                      <>
                        <Field id={id + 'decision'} label="Decisão">
                          <select id={id + 'decision'} name="decision" defaultValue="" required>
                            <option value="" disabled>
                              Selecione
                            </option>
                            <option value="approve">
                              {row.kind === 'deliverable'
                                ? 'Enviar para validação do Cliente'
                                : 'Encerrar ocorrência'}
                            </option>
                            <option value="return">Devolver para ajustes</option>
                          </select>
                        </Field>
                        <Field id={id + 'note'} label="Motivo da devolução ou observação">
                          <textarea id={id + 'note'} name="note" maxLength={2000} rows={2} />
                        </Field>
                      </>
                    )}
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
          <WorkspacePagination total={queue.data.total} page={page} change={setPage} />
        </>
      )}
    </section>
  );
}
