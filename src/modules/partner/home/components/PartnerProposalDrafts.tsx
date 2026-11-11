import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { useState } from 'react';
import { Input, TextArea } from '../../../../components/ds/field/Controls';
import { Field } from '../../../../components/ds/field/Field';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';
import { Panel } from '../../../../components/ds/panel/Panel';
import { ActionForm } from '../../../../components/workspace/ActionForm';
import { WorkspacePagination } from '../../../../components/workspace/WorkspacePagination';

export function PartnerProposalDrafts({ company, actor }: { company: string; actor: string }) {
  const { partnerProposalDrafts } = useRouteContext({ from: '__root__' });
  const [page, setPage] = useState(1);
  const cache = useQueryClient();
  const key = ['partner-proposal-drafts', actor, company];
  const result = useQuery({
    queryKey: [...key, page],
    queryFn: partnerProposalDrafts
      ? ({ signal }) => partnerProposalDrafts.list(company, page, signal)
      : skipToken,
  });
  if (!partnerProposalDrafts || (!result.isError && !result.data?.total)) return null;
  const service = partnerProposalDrafts;

  return (
    <Panel aria-label="Propostas designadas" className="tw:grid tw:gap-3">
      <h2 className="tw:m-0 tw:text-section">Propostas designadas</h2>
      {result.isError && (
        <FeedbackState kind="error" onRetry={() => void result.refetch()}>
          Não foi possível consultar suas propostas.
        </FeedbackState>
      )}
      {result.data?.rows.map((row) => (
        <section
          key={row.id}
          className="tw:grid tw:gap-2 tw:border-t tw:border-border-default tw:pt-3"
        >
          <strong>
            {row.protocol} · {row.service}
          </strong>
          {row.state === 'pending' && <p>Aguardando revisão da CALI.</p>}
          {row.state === 'accepted' && <p>Rascunho aceito pela CALI.</p>}
          {row.state === 'returned' && <p>Devolvido para ajuste. {row.decision}</p>}
          {row.canSubmit && (
            <ActionForm
              label="Enviar proposta para revisão"
              submit={async (data, id) => {
                const result = await service.submit(
                  company,
                  row,
                  id,
                  String(data.get('terms') ?? ''),
                  String(data.get('notes') ?? ''),
                  Number(data.get('validity')),
                );
                await cache.invalidateQueries({ queryKey: key });
                return result;
              }}
            >
              {(prefix) => (
                <>
                  <Field id={prefix + 'terms'} label="Condições de pagamento">
                    <TextArea
                      id={prefix + 'terms'}
                      name="terms"
                      maxLength={2000}
                      defaultValue={row.paymentTerms ?? ''}
                    />
                  </Field>
                  <Field id={prefix + 'notes'} label="Observações da proposta">
                    <TextArea
                      id={prefix + 'notes'}
                      name="notes"
                      maxLength={4000}
                      defaultValue={row.publicNotes ?? ''}
                    />
                  </Field>
                  <Field id={prefix + 'validity'} label="Validade em dias">
                    <Input
                      id={prefix + 'validity'}
                      name="validity"
                      type="number"
                      min={1}
                      max={120}
                      required
                      defaultValue={row.validityDays ?? 15}
                    />
                  </Field>
                </>
              )}
            </ActionForm>
          )}
        </section>
      ))}
      {result.data && (
        <WorkspacePagination total={result.data.total} page={page} change={setPage} />
      )}
    </Panel>
  );
}
