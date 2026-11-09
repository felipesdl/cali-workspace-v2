import { useState } from 'react';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useRouteContext } from '@tanstack/react-router';
import { Button } from '../../../../components/ds/button/Button';
import { Checkbox } from '../../../../components/ds/checkbox/Checkbox';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';
import { FileDownload } from '../../../../components/documents/FileDownload';
import { ActionForm } from '../../../../components/workspace/ActionForm';
import { FormDraftEditor, NewFormDraft } from './FormDraftEditor';
import { FormTriage } from './FormTriage';

export function FormAdministration({ company, actor }: { company: string; actor?: string }) {
  const { domainOperations } = useRouteContext({ from: '__root__' });
  const [page, setPage] = useState(1);
  const [selectedForm, setSelectedForm] = useState<string | null>(null);
  const cache = useQueryClient();
  const key = ['phase4-forms', actor, company];
  const forms = useQuery({
    queryKey: [...key, page],
    queryFn: domainOperations
      ? ({ signal }) => domainOperations.forms(company, page, signal)
      : skipToken,
  });
  if (!domainOperations) return null;
  const operations = domainOperations;
  return (
    <section aria-label="Formulários da empresa" className="tw:grid tw:gap-3">
      <NewFormDraft
        company={company}
        actor={actor}
        operations={operations}
        saved={() => setPage(1)}
      />
      {forms.isPending && <p role="status">Carregando formulários…</p>}
      {forms.isError && (
        <FeedbackState kind="error" onRetry={() => void forms.refetch()}>
          Não foi possível consultar os formulários.
        </FeedbackState>
      )}
      {forms.data?.length === 0 && <p>Nenhum formulário nesta página.</p>}
      {forms.data?.map((form) => (
        <article
          key={form.id}
          className="tw:grid tw:min-w-0 tw:gap-2 tw:rounded-control tw:border tw:border-border-default tw:p-4 tw:wrap-anywhere"
        >
          <h2>{form.title}</h2>
          <p>
            {form.slug} · {form.responses} resposta(s) ·{' '}
            {form.status === 'open' ? 'Aberto' : form.status === 'draft' ? 'Rascunho' : 'Fechado'}
          </p>
          {form.publicTextLink && (
            <Link to="/f/$slug" params={{ slug: form.slug }} className="tw:underline">
              Abrir link público de resposta
            </Link>
          )}
          {form.status === 'draft' && form.responses === 0 && (
            <FormDraftEditor company={company} actor={actor} id={form.id} operations={operations} />
          )}
          {form.responses > 0 && (
            <Button
              variant="secondary"
              aria-expanded={selectedForm === form.id}
              onClick={() => setSelectedForm(selectedForm === form.id ? null : form.id)}
            >
              {selectedForm === form.id ? 'Fechar triagem' : 'Acompanhar respostas'}
            </Button>
          )}
          {form.textExportAvailable && form.responses > 0 && (
            <FileDownload
              label="Exportar Excel"
              download={async (signal) => {
                const result = await operations.formExport(company, form.id, signal);
                const { formSpreadsheet } = await import('./form-spreadsheet');
                return formSpreadsheet(result);
              }}
            />
          )}
          {selectedForm === form.id && (
            <FormTriage company={company} actor={actor} form={form.id} operations={operations} />
          )}
          {form.status === 'open' || form.publicOpeningAvailable ? (
            <ActionForm
              key={form.status}
              label={
                form.status === 'open' ? 'Encerrar formulário' : 'Abrir coleta por link público'
              }
              submit={async (fields) => {
                const id =
                  form.status === 'open'
                    ? await operations.closeForm(company, form.id)
                    : await operations.openPublicForm(
                        company,
                        form.id,
                        form.status,
                        fields.get('publicLinkConfirmed') === 'on',
                      );
                await cache.invalidateQueries({ queryKey: key });
                return id;
              }}
            >
              {form.status !== 'open'
                ? (prefix) => (
                    <Checkbox id={prefix + 'public'} name="publicLinkConfirmed" required>
                      Entendo que qualquer pessoa com o link poderá responder sem entrar no
                      Workspace.
                    </Checkbox>
                  )
                : undefined}
            </ActionForm>
          ) : (
            <p>Este formulário ainda não atende aos requisitos da coleta pública da V2.</p>
          )}
        </article>
      ))}
      {forms.isSuccess && (page > 1 || forms.data.length === 25) && (
        <div className="tw:flex tw:gap-2">
          <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          <Button
            variant="secondary"
            disabled={forms.data.length < 25}
            onClick={() => setPage(page + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </section>
  );
}
