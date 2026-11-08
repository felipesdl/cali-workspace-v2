import { useState } from 'react';
import { skipToken, useQuery } from '@tanstack/react-query';
import { getRouteApi, useRouteContext } from '@tanstack/react-router';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { Field } from '../../components/ds/field/Field';
import { ActionForm } from './ActionForm';

const route = getRouteApi('/f/$slug');

export function PublicTextFormPage() {
  const { slug } = route.useParams();
  return <PublicTextForm key={slug} slug={slug} />;
}

function PublicTextForm({ slug }: { slug: string }) {
  const { domainOperations } = useRouteContext({ from: '__root__' });
  const [sent, setSent] = useState(false);
  const enabled = domainOperations && /^[a-z0-9-]{1,100}$/.test(slug);
  const result = useQuery({
    queryKey: ['phase4-public-text-form', slug],
    queryFn: enabled
      ? ({ signal }) => domainOperations.readPublicTextForm(slug, signal)
      : skipToken,
    retry: false,
    gcTime: 0,
  });
  const form = result.data;

  return (
    <main className="tw:mx-auto tw:grid tw:max-w-2xl tw:gap-4 tw:p-6 tw:text-copy">
      <h1 className="tw:text-section tw:text-brand">
        {form?.status === 'open' ? form.title : 'Formulário CALI'}
      </h1>
      {enabled && result.isPending && (
        <FeedbackState kind="loading">Carregando formulário…</FeedbackState>
      )}
      {enabled && result.isError && (
        <FeedbackState kind="error" onRetry={() => void result.refetch()}>
          Não foi possível consultar o formulário.
        </FeedbackState>
      )}
      {(!enabled || (result.isSuccess && !form)) && <p>Formulário indisponível.</p>}
      {form?.status === 'closed' && <p>Este formulário encerrou a coleta.</p>}
      {sent && <p role="status">Resposta registrada. Obrigado pela participação.</p>}
      {domainOperations && form?.status === 'open' && !sent && (
        <>
          {form.description && <p className="tw:whitespace-pre-line">{form.description}</p>}
          <ActionForm
            label="Enviar respostas"
            submit={(fields, request) =>
              domainOperations.submitPublicTextForm(
                slug,
                request,
                Object.fromEntries(
                  form.questions.map(({ id }) => [id, String(fields.get(id) ?? '').trim()]),
                ),
              )
            }
            saved={() => setSent(true)}
          >
            {(prefix) =>
              form.questions.map(({ id, kind, label, required }) => (
                <Field key={id} id={prefix + id} label={label}>
                  {kind === 'short_text' ? (
                    <input id={prefix + id} name={id} required={required} maxLength={5000} />
                  ) : (
                    <textarea id={prefix + id} name={id} required={required} maxLength={5000} />
                  )}
                </Field>
              ))
            }
          </ActionForm>
        </>
      )}
    </main>
  );
}
