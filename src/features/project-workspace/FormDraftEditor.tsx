import { useState } from 'react';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type DomainOperations,
  type FormDraft,
  type FormDraftChange,
} from '../../api/modules/project-workspace/domain-operations';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';
import { Checkbox } from '../../components/ds/checkbox/Checkbox';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { ActionForm } from './ActionForm';

type Scope = { company: string; actor?: string; operations: DomainOperations };
const text = (fields: FormData, name: string) => String(fields.get(name) ?? '');

export function NewFormDraft({ company, actor, operations, saved }: Scope & { saved: () => void }) {
  const cache = useQueryClient();
  return (
    <ActionForm
      label="Criar rascunho de formulário"
      saved={saved}
      submit={async (fields, id) => {
        const result = await operations.createFormDraft(
          company,
          id,
          text(fields, 'title'),
          text(fields, 'slug'),
        );
        await cache.invalidateQueries({ queryKey: ['phase4-forms', actor, company] });
        return result;
      }}
    >
      {(prefix) => (
        <>
          <Field id={prefix + 'title'} label="Título do formulário">
            <input id={prefix + 'title'} name="title" required maxLength={160} />
          </Field>
          <Field id={prefix + 'slug'} label="Identificador do endereço">
            <input
              id={prefix + 'slug'}
              name="slug"
              required
              minLength={3}
              maxLength={60}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            />
          </Field>
        </>
      )}
    </ActionForm>
  );
}

export function FormDraftEditor({ company, actor, operations, id }: Scope & { id: string }) {
  const [open, setOpen] = useState(false);
  const cache = useQueryClient();
  const key = ['phase4-form-draft', actor, company, id];
  const query = useQuery({
    queryKey: key,
    queryFn: open ? ({ signal }) => operations.formDraft(company, id, signal) : skipToken,
  });
  async function save(draft: FormDraft, change: FormDraftChange) {
    const saved = await operations.editFormDraft(company, draft, change);
    await Promise.all([
      cache.invalidateQueries({ queryKey: key }),
      cache.invalidateQueries({ queryKey: ['phase4-forms', actor, company] }),
    ]);
    return saved;
  }
  return (
    <div className="tw:grid tw:gap-3">
      <div>
        <Button variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Fechar rascunho' : 'Editar rascunho'}
        </Button>
      </div>
      {open && query.isPending && (
        <FeedbackState kind="loading">Carregando rascunho…</FeedbackState>
      )}
      {open && query.isError && (
        <FeedbackState kind="error" onRetry={() => void query.refetch()}>
          Não foi possível consultar o rascunho.
        </FeedbackState>
      )}
      {open && query.isSuccess && !query.data && (
        <p>Este formulário não está disponível para edição.</p>
      )}
      {open && query.data && (
        <DraftContent key={query.data.updatedAt} draft={query.data} save={save} />
      )}
    </div>
  );
}

function QuestionFields({
  prefix,
  label,
  required,
}: {
  prefix: string;
  label?: string;
  required?: boolean;
}) {
  return (
    <>
      <Field id={prefix + 'label'} label="Texto da pergunta">
        <textarea
          id={prefix + 'label'}
          name="label"
          defaultValue={label}
          maxLength={400}
          required
        />
      </Field>
      <Checkbox name="required" defaultChecked={required}>
        Resposta obrigatória
      </Checkbox>
    </>
  );
}

function DraftContent({
  draft,
  save,
}: {
  draft: FormDraft;
  save: (draft: FormDraft, change: FormDraftChange) => Promise<string>;
}) {
  return (
    <div className="tw:grid tw:gap-3">
      <ActionForm
        label="Salvar título e descrição"
        submit={(fields) =>
          save(draft, {
            action: 'details',
            title: text(fields, 'title'),
            description: text(fields, 'description'),
          })
        }
      >
        {(prefix) => (
          <>
            <Field id={prefix + 'title'} label="Título">
              <input
                id={prefix + 'title'}
                name="title"
                required
                maxLength={160}
                defaultValue={draft.title}
              />
            </Field>
            <Field id={prefix + 'description'} label="Descrição">
              <textarea
                id={prefix + 'description'}
                name="description"
                maxLength={1200}
                defaultValue={draft.description}
              />
            </Field>
          </>
        )}
      </ActionForm>
      <ol className="tw:grid tw:gap-2">
        {draft.questions.map((question) => (
          <li key={question.id}>
            <p>{question.label}</p>
            {(question.kind === 'short_text' || question.kind === 'long_text') && (
              <details>
                <summary>Editar pergunta de texto</summary>
                <ActionForm
                  label="Salvar pergunta"
                  submit={(fields) =>
                    save(draft, {
                      action: 'edit_question',
                      id: question.id,
                      label: text(fields, 'label'),
                      required: fields.has('required'),
                    })
                  }
                >
                  {(prefix) => (
                    <QuestionFields
                      prefix={prefix}
                      label={question.label}
                      required={question.required}
                    />
                  )}
                </ActionForm>
              </details>
            )}
          </li>
        ))}
      </ol>
      {draft.questions.length < 40 && (
        <ActionForm
          label="Adicionar pergunta de texto"
          submit={(fields) =>
            save(draft, {
              action: 'add_question',
              kind: fields.get('kind') === 'long_text' ? 'long_text' : 'short_text',
              label: text(fields, 'label'),
              required: fields.has('required'),
            })
          }
        >
          {(prefix) => (
            <>
              <Field id={prefix + 'kind'} label="Tipo de resposta">
                <select id={prefix + 'kind'} name="kind">
                  <option value="short_text">Resposta curta</option>
                  <option value="long_text">Resposta longa</option>
                </select>
              </Field>
              <QuestionFields prefix={prefix} required />
            </>
          )}
        </ActionForm>
      )}
    </div>
  );
}
