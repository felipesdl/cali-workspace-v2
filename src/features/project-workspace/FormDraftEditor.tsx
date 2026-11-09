import { useEffect, useRef, useState } from 'react';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  formQuestionKind,
  FORM_BRANCH_END,
  type DomainOperations,
  type FormDraft,
  type FormDraftChange,
  type FormQuestionKind,
} from '../../api/modules/project-workspace/domain-operations';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';
import { Checkbox } from '../../components/ds/checkbox/Checkbox';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { ActionForm } from './ActionForm';

type Scope = { company: string; actor?: string; operations: DomainOperations };
const questionLabels = {
  name: 'Nome',
  email: 'E-mail',
  phone: 'Telefone / WhatsApp',
  short_text: 'Resposta curta',
  long_text: 'Resposta longa',
  number: 'Número',
  date: 'Data',
  single_choice: 'Escolha única',
  multi_choice: 'Escolha múltipla',
  yes_no: 'Sim ou não',
  scale: 'Escala',
  statement: 'Bloco de texto',
  file: 'Anexo PDF (até 2 MiB)',
};

const text = (fields: FormData, name: string) => String(fields.get(name) ?? '');
const hasChoices = (kind: string) => kind === 'single_choice' || kind === 'multi_choice';
const choices = (fields: FormData, kind: string) =>
  hasChoices(kind)
    ? text(fields, 'options')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    : undefined;

const scaleFields = [
  { name: 'scaleMin', label: 'Valor mínimo', defaultValue: 0, numeric: true },
  { name: 'scaleMax', label: 'Valor máximo', defaultValue: 10, numeric: true },
  { name: 'minLabel', label: 'Rótulo do mínimo', defaultValue: '', numeric: false },
  { name: 'maxLabel', label: 'Rótulo do máximo', defaultValue: '', numeric: false },
] as const;

function scaleSettings(fields: FormData, kind: string) {
  if (kind !== 'scale') return {};
  return {
    scaleMin: Number(text(fields, 'scaleMin')),
    scaleMax: Number(text(fields, 'scaleMax')),
    minLabel: text(fields, 'minLabel'),
    maxLabel: text(fields, 'maxLabel'),
  };
}

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

export function FormDraftEditor({
  company,
  actor,
  operations,
  id,
}: Omit<Scope, 'operations'> & {
  id: string;
  operations: Pick<DomainOperations, 'formDraft' | 'editFormDraft'>;
}) {
  const [open, setOpen] = useState(false);
  const [savedVersion, setSavedVersion] = useState<string>();
  const receipt = useRef<HTMLParagraphElement>(null);
  const cache = useQueryClient();
  const key = ['phase4-form-draft', actor, company, id];
  const query = useQuery({
    queryKey: key,
    queryFn: open ? ({ signal }) => operations.formDraft(company, id, signal) : skipToken,
  });
  const currentVersion = query.data?.updatedAt;
  const showReceipt = open && savedVersion !== undefined && currentVersion === savedVersion;
  useEffect(() => {
    if (showReceipt && document.activeElement === document.body) receipt.current?.focus();
  }, [showReceipt]);

  async function save(draft: FormDraft, change: FormDraftChange) {
    setSavedVersion(undefined);
    const saved = await operations.editFormDraft(company, draft, change);
    await Promise.all([
      cache.invalidateQueries({ queryKey: key }),
      cache.invalidateQueries({ queryKey: ['phase4-forms', actor, company] }),
    ]);
    const nextVersion = cache.getQueryData<FormDraft>(key)?.updatedAt;
    if (nextVersion !== draft.updatedAt) setSavedVersion(nextVersion);
    return saved;
  }
  return (
    <div className="tw:grid tw:gap-3">
      <div>
        <Button
          variant="secondary"
          aria-expanded={open}
          onClick={() => {
            setSavedVersion(undefined);
            setOpen(!open);
          }}
        >
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
      {showReceipt && (
        <p ref={receipt} role="status" tabIndex={-1} className="tw:m-0 tw:text-caption">
          Rascunho atualizado.
        </p>
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
  kind,
  options,
  scale,
}: {
  prefix: string;
  label?: string;
  required?: boolean;
  kind: string;
  options?: string[] | null;
  scale?: FormDraft['questions'][number];
}) {
  return (
    <>
      <Field
        id={prefix + 'label'}
        label={kind === 'statement' ? 'Texto do bloco' : 'Texto da pergunta'}
      >
        <textarea
          id={prefix + 'label'}
          name="label"
          defaultValue={label}
          maxLength={400}
          required
        />
      </Field>
      {hasChoices(kind) && (
        <Field id={prefix + 'options'} label="Opções, uma por linha">
          <textarea
            id={prefix + 'options'}
            name="options"
            required
            defaultValue={options?.join('\n')}
          />
        </Field>
      )}
      {kind === 'scale' &&
        scaleFields.map(({ name, label, defaultValue, numeric }) => (
          <Field key={name} id={prefix + name} label={label}>
            <input
              id={prefix + name}
              name={name}
              defaultValue={scale?.[name] ?? defaultValue}
              {...(numeric
                ? { type: 'number', min: 0, max: 10, step: 1, required: true }
                : { maxLength: 80 })}
            />
          </Field>
        ))}
      {kind !== 'statement' && (
        <Checkbox name="required" defaultChecked={required}>
          Resposta obrigatória
        </Checkbox>
      )}
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
  const [kind, setKind] = useState<FormQuestionKind>('short_text');
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
        {draft.questions.map((question, index) => (
          <li key={question.id}>
            <p>{question.label}</p>
            {formQuestionKind.safeParse(question.kind).success && (
              <details>
                <summary>Editar pergunta</summary>
                <ActionForm
                  label="Salvar pergunta"
                  submit={(fields) =>
                    save(draft, {
                      action: 'edit_question',
                      id: question.id,
                      options: choices(fields, question.kind),
                      ...scaleSettings(fields, question.kind),
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
                      kind={question.kind}
                      options={question.options}
                      scale={question}
                    />
                  )}
                </ActionForm>
              </details>
            )}
            <QuestionBranch
              question={question}
              destinations={draft.questions.slice(index + 1)}
              save={(change) => save(draft, change)}
            />
          </li>
        ))}
      </ol>
      {draft.questions.length < 40 && (
        <ActionForm
          label="Adicionar pergunta"
          submit={(fields) =>
            save(draft, {
              action: 'add_question',
              kind,
              options: choices(fields, kind),
              ...scaleSettings(fields, kind),
              label: text(fields, 'label'),
              required: fields.has('required'),
            })
          }
        >
          {(prefix) => (
            <>
              <Field id={prefix + 'kind'} label="Tipo de resposta">
                <select
                  id={prefix + 'kind'}
                  name="kind"
                  value={kind}
                  onChange={(event) => setKind(formQuestionKind.parse(event.currentTarget.value))}
                >
                  {formQuestionKind.options
                    .filter(
                      (option) =>
                        option !== 'file' ||
                        !draft.questions.some((question) => question.kind === 'file'),
                    )
                    .map((kind) => (
                      <option key={kind} value={kind}>
                        {questionLabels[kind]}
                      </option>
                    ))}
                </select>
              </Field>
              <QuestionFields prefix={prefix} kind={kind} required />
            </>
          )}
        </ActionForm>
      )}
    </div>
  );
}

function QuestionBranch({
  question,
  destinations,
  save,
}: {
  question: FormDraft['questions'][number];
  destinations: FormDraft['questions'];
  save: (change: FormDraftChange) => Promise<string>;
}) {
  const options = question.kind === 'yes_no' ? ['Sim', 'Não'] : question.options;
  if ((question.kind !== 'single_choice' && question.kind !== 'yes_no') || !options?.length) {
    return null;
  }

  return (
    <details>
      <summary>Caminho por resposta</summary>
      <ActionForm
        label="Salvar caminhos da pergunta"
        submit={(fields) =>
          save({
            action: 'set_logic',
            id: question.id,
            logic: options.flatMap((option, index) => {
              const goTo = text(fields, 'route-' + index);
              return goTo ? [{ when: option, goTo }] : [];
            }),
          })
        }
      >
        {(prefix) =>
          options.map((option, index) => {
            const name = 'route-' + index;
            return (
              <Field key={option} id={prefix + name} label={'Se responder ' + option}>
                <select
                  id={prefix + name}
                  name={name}
                  defaultValue={question.logic?.find((rule) => rule.when === option)?.goTo ?? ''}
                >
                  <option value="">Seguir para a próxima pergunta</option>
                  {destinations.map((destination) => (
                    <option key={destination.id} value={destination.id}>
                      {destination.label}
                    </option>
                  ))}
                  <option value={FORM_BRANCH_END}>Encerrar perguntas</option>
                </select>
              </Field>
            );
          })
        }
      </ActionForm>
    </details>
  );
}
