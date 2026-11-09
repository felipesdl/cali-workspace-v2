import { FeedbackMessage } from '../../../../components/ds/feedback/FeedbackMessage';
import { Input, Select } from '../../../../components/ds/field/Controls';
import { PdfDownload } from '../../../../components/documents/PdfDownload';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type DomainOperations } from '../../../../api/shared/workspace/domain-operations';
import { Button } from '../../../../components/ds/button/Button';
import { Field } from '../../../../components/ds/field/Field';
import { formatServerInstant } from '../../../../lib/dates';
import { ActionForm } from '../../../../components/workspace/ActionForm';

export function FormTriage({
  company,
  actor,
  form,
  operations,
}: {
  company: string;
  actor?: string;
  form: string;
  operations: DomainOperations;
}) {
  const [page, setPage] = useState(1);
  const cache = useQueryClient();
  const key = ['phase4-form-triage', actor, company, form];
  const triage = useQuery({
    queryKey: [...key, page],
    queryFn: ({ signal }) => operations.formTriage(company, form, page, signal),
  });

  if (triage.isPending) return <p role="status">Carregando respostas…</p>;
  if (triage.isError || !triage.data)
    return <FeedbackMessage tone="error">Triagem indisponível.</FeedbackMessage>;
  const { stages, responses } = triage.data;

  return (
    <section aria-label="Triagem de respostas" className="tw:grid tw:gap-3">
      {responses.length === 0 && <p>Nenhuma resposta nesta página.</p>}
      {responses.map((response) => {
        const choices = new Set(stages);
        if (response.stage) choices.add(response.stage);
        return (
          <article key={response.id} className="tw:grid tw:gap-2">
            <ActionForm
              key={JSON.stringify([response.stage, response.owner])}
              label="Salvar triagem"
              submit={async (fields) => {
                const id = await operations.saveFormTriage(
                  company,
                  form,
                  response,
                  String(fields.get('stage') ?? ''),
                  String(fields.get('owner') ?? ''),
                );
                await cache.invalidateQueries({ queryKey: key });
                return id;
              }}
            >
              {(prefix) => (
                <>
                  <p>
                    {response.respondent_name || 'Resposta sem nome'} ·{' '}
                    {formatServerInstant(response.submitted_at)}
                  </p>
                  <Field id={prefix + 'stage'} label="Etapa">
                    <Select id={prefix + 'stage'} name="stage" defaultValue={response.stage ?? ''}>
                      <option value="">Sem etapa</option>
                      {[...choices].map((stage) => (
                        <option key={stage}>{stage}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field id={prefix + 'owner'} label="Responsável">
                    <Input
                      id={prefix + 'owner'}
                      name="owner"
                      maxLength={120}
                      defaultValue={response.owner ?? ''}
                    />
                  </Field>
                </>
              )}
            </ActionForm>
            {response.pdfAvailable && (
              <PdfDownload
                download={(signal) =>
                  operations.formResponsePdf(company, form, response.id, signal)
                }
              />
            )}
          </article>
        );
      })}
      {(page > 1 || responses.length === 25) && (
        <div className="tw:flex tw:gap-2">
          <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          <Button
            variant="secondary"
            disabled={responses.length < 25}
            onClick={() => setPage(page + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </section>
  );
}
