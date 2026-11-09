import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PartnerDetailModule, PartnerPilot } from '../../api/modules/partner/pilot';
import { Button } from '../../components/ds/button/Button';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { formatServerInstant } from '../../lib/dates';
import { WorkspacePagination } from '../project-workspace/WorkspacePagination';
import { workspaceLabel } from '../project-workspace/workspace-labels';

export function PartnerItemDetail({
  api,
  actor,
  company,
  module,
  id,
  back,
}: {
  api: PartnerPilot;
  actor: string;
  company: string;
  module: PartnerDetailModule;
  id: string;
  back: () => void;
}) {
  const [page, setPage] = useState(1);
  const result = useQuery({
    queryKey: ['partner-detail', actor, company, module, id, page],
    queryFn: ({ signal }) => api.detail(company, module, id, page, signal),
    refetchInterval: 30000,
  });
  return (
    <section
      className="tw:grid tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4"
      aria-label="Detalhe do registro"
    >
      <div>
        <Button variant="secondary" onClick={back}>
          Voltar à lista
        </Button>
      </div>
      {result.isPending && <FeedbackState kind="loading">Carregando detalhe…</FeedbackState>}
      {result.isError && (
        <FeedbackState kind="error" onRetry={() => void result.refetch()}>
          Não foi possível consultar o detalhe.
        </FeedbackState>
      )}
      {result.isSuccess && !result.data && (
        <FeedbackState kind="empty">Registro indisponível.</FeedbackState>
      )}
      {result.isSuccess && result.data && (
        <>
          <h2 className="tw:text-section tw:font-semibold">{result.data.title}</h2>
          {result.data.rows.length ? (
            <ul className="tw:grid tw:gap-3">
              {result.data.rows.map((row) => (
                <li
                  key={row.id}
                  className="tw:grid tw:gap-1 tw:border-b tw:border-border-default tw:pb-3"
                >
                  <p className="tw:wrap-anywhere tw:whitespace-pre-line">{row.title}</p>
                  <p className="tw:text-caption tw:text-muted-copy">
                    {[
                      row.protocol,
                      row.status && workspaceLabel(row.status),
                      row.instant && formatServerInstant(row.instant),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <FeedbackState kind="empty">Nenhum item nesta página.</FeedbackState>
          )}
          <WorkspacePagination total={result.data.total} page={page} change={setPage} />
        </>
      )}
    </section>
  );
}
