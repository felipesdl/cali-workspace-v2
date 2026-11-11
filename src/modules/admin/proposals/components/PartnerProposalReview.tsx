import { useQuery, useQueryClient, skipToken } from '@tanstack/react-query';
import { useState } from 'react';
import { type PartnerProposalDraftService } from '../../../../api/partner/proposal-drafts';
import { Select, TextArea } from '../../../../components/ds/field/Controls';
import { Field } from '../../../../components/ds/field/Field';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';
import { ActionForm } from '../../../../components/workspace/ActionForm';

export function PartnerProposalReview({
  company,
  opportunity,
  actor,
  service,
}: {
  company: string;
  opportunity: string;
  actor?: string;
  service: PartnerProposalDraftService;
}) {
  const [open, setOpen] = useState(false);
  const cache = useQueryClient();
  const key = ['partner-proposal-review', actor, company, opportunity];
  const result = useQuery({
    queryKey: key,
    queryFn: open ? ({ signal }) => service.admin(company, opportunity, signal) : skipToken,
  });
  const draft = result.data?.draft;
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Preparação e revisão pelo parceiro</summary>
      {open && result.isPending && (
        <FeedbackState kind="loading">Consultando revisão…</FeedbackState>
      )}
      {open && result.isError && (
        <FeedbackState kind="error">Revisão do parceiro indisponível.</FeedbackState>
      )}
      {open && result.data && (
        <div className="tw:grid tw:gap-2 tw:pt-2">
          {draft?.state !== 'pending' &&
            draft?.state !== 'accepted' &&
            result.data.options.length > 0 && (
              <ActionForm
                label="Atribuir proposta a parceiro"
                submit={async (data) => {
                  await service.assign(company, opportunity, String(data.get('invite') ?? ''));
                  await cache.invalidateQueries({ queryKey: key });
                }}
              >
                {(prefix) => (
                  <Field id={prefix + 'invite'} label="Parceiro responsável">
                    <Select
                      id={prefix + 'invite'}
                      name="invite"
                      required
                      defaultValue={result.data?.assigned ?? ''}
                    >
                      <option value="" disabled>
                        Selecione
                      </option>
                      {result.data?.options.map(({ id, name }) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
              </ActionForm>
            )}
          {draft && (
            <>
              <p>
                Rascunho de <strong>{draft.author}</strong>
              </p>
              <dl className="tw:m-0">
                <dt>Condições de pagamento</dt>
                <dd className="tw:m-0 tw:whitespace-pre-wrap">
                  {draft.paymentTerms || 'Sem condição adicional'}
                </dd>
                <dt>Observações</dt>
                <dd className="tw:m-0 tw:whitespace-pre-wrap">
                  {draft.publicNotes || 'Sem observações'}
                </dd>
                <dt>Validade</dt>
                <dd className="tw:m-0">{draft.validityDays} dias</dd>
              </dl>
              {draft.state === 'accepted' && <p>Rascunho incorporado à proposta.</p>}
              {draft.state === 'returned' && <p>Devolvido. {draft.decision}</p>}
              {draft.state === 'pending' && (
                <ActionForm
                  label="Registrar revisão"
                  submit={async (data) => {
                    const id = await service.decide(
                      company,
                      opportunity,
                      draft.id,
                      data.get('decision') === 'accept',
                      String(data.get('note') ?? ''),
                    );
                    await Promise.all([
                      cache.invalidateQueries({ queryKey: key }),
                      cache.invalidateQueries({ queryKey: ['phase4-commercial', actor, company] }),
                    ]);
                    return id;
                  }}
                >
                  {(prefix) => (
                    <>
                      <Field id={prefix + 'decision'} label="Decisão">
                        <Select id={prefix + 'decision'} name="decision" required defaultValue="">
                          <option value="" disabled>
                            Selecione
                          </option>
                          <option value="accept">Incorporar ao rascunho</option>
                          <option value="return">Devolver ao parceiro</option>
                        </Select>
                      </Field>
                      <Field id={prefix + 'note'} label="Observação da revisão">
                        <TextArea id={prefix + 'note'} name="note" maxLength={1000} />
                      </Field>
                    </>
                  )}
                </ActionForm>
              )}
            </>
          )}
        </div>
      )}
    </details>
  );
}
