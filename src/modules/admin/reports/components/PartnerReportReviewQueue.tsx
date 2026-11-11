import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { type PartnerReportDraftService } from '../../../../api/partner/report-drafts';
import { Button } from '../../../../components/ds/button/Button';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';
import { Field } from '../../../../components/ds/field/Field';
import { TextArea } from '../../../../components/ds/field/Controls';
import { ActionForm } from '../../../../components/workspace/ActionForm';
import { WorkspacePagination } from '../../../../components/workspace/WorkspacePagination';
import { formatOverviewMonth } from '../../overview/components/overview-format';

const panel =
  'tw:grid tw:min-w-0 tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4';

export function PartnerReportReviewQueue({
  service,
  company,
  actor,
}: {
  service: PartnerReportDraftService;
  company: string;
  actor?: string;
}) {
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const queryKey = ['partner-report-drafts-admin', actor, company, page] as const;
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => service.listAdmin(company, page, signal),
  });
  const materialize = useMutation({
    mutationFn: (draft: { id: string; updatedAt: string }) =>
      service.materialize(company, draft.id, draft.updatedAt),
    onSuccess: async (result) => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['partner-report-drafts-admin', actor, company] }),
        cache.invalidateQueries({ queryKey: ['phase4-catalog', actor, company, 'reports'] }),
      ]);
      return result;
    },
  });
  return (
    <section className={panel} aria-labelledby="partner-report-review-title">
      <header>
        <h2 id="partner-report-review-title" className="tw:m-0 tw:text-section tw:font-semibold">
          Relatórios enviados pelo parceiro
        </h2>
        <p className="tw:mt-1 tw:mb-0 tw:text-caption tw:text-muted-copy">
          Revise o texto e, quando estiver pronto, crie o rascunho interno para seguir o fluxo
          normal de aprovação. Nada é liberado ao cliente nesta etapa.
        </p>
      </header>
      {query.isPending ? (
        <FeedbackState kind="loading">Consultando relatórios enviados…</FeedbackState>
      ) : query.isError ? (
        <FeedbackState kind="error" onRetry={() => void query.refetch()}>
          Não foi possível consultar os relatórios enviados pelo parceiro.
        </FeedbackState>
      ) : query.data.rows.length ? (
        <ul className="tw:m-0 tw:grid tw:list-none tw:gap-3 tw:p-0">
          {query.data.rows.map((draft) => (
            <li
              key={draft.id}
              className="tw:grid tw:gap-2 tw:border-t tw:border-border-default tw:pt-3"
            >
              <div className="tw:flex tw:flex-wrap tw:items-baseline tw:justify-between tw:gap-2">
                <strong>{draft.title}</strong>
                <span className="tw:text-caption tw:text-muted-copy">
                  {formatOverviewMonth(draft.month)} · {draft.authorName} ·{' '}
                  {draft.status === 'submitted'
                    ? 'Aguardando revisão'
                    : draft.status === 'returned'
                      ? 'Devolvido para ajuste'
                      : 'Rascunho criado'}
                </span>
              </div>
              <p className="tw:m-0 tw:whitespace-pre-line">{draft.summary}</p>
              {draft.reportId && (
                <p className="tw:m-0 tw:text-caption">
                  O rascunho interno já está no fluxo de Relatórios.
                </p>
              )}
              {draft.decisionNote && <p className="tw:m-0">{draft.decisionNote}</p>}
              {draft.status === 'submitted' && (
                <>
                  <Button
                    pending={materialize.isPending && materialize.variables?.id === draft.id}
                    disabled={materialize.isPending}
                    onClick={() => materialize.mutate(draft)}
                  >
                    Preparar rascunho para revisão Admin
                  </Button>
                  <ActionForm
                    label="Devolver para ajuste"
                    submit={async (data) => {
                      await service.returnDraft(
                        company,
                        draft.id,
                        draft.updatedAt,
                        String(data.get('note') ?? ''),
                      );
                      await cache.invalidateQueries({
                        queryKey: ['partner-report-drafts-admin', actor, company],
                      });
                    }}
                  >
                    {(prefix) => (
                      <Field id={prefix + 'note'} label="Ajuste solicitado">
                        <TextArea id={prefix + 'note'} name="note" required maxLength={2000} />
                      </Field>
                    )}
                  </ActionForm>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <FeedbackState kind="empty">Nenhum relatório enviado pelo parceiro.</FeedbackState>
      )}
      {materialize.isError && (
        <p role="alert" className="tw:text-danger tw:m-0">
          {materialize.error.message}
        </p>
      )}
      {materialize.isSuccess && (
        <p role="status" className="tw:m-0">
          Rascunho criado. Abra o relatório no histórico para continuar a revisão.
        </p>
      )}
      {query.isSuccess && (
        <WorkspacePagination total={query.data.total} page={page} change={setPage} />
      )}
    </section>
  );
}
