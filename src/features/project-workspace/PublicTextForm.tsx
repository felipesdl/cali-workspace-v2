import { useState } from 'react';
import { skipToken, useQuery } from '@tanstack/react-query';
import { getRouteApi, useRouteContext } from '@tanstack/react-router';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import {
  FORM_BRANCH_END,
  type PublicFormQuestion,
} from '../../api/modules/project-workspace/domain-operations';
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
  const [branchAnswers, setBranchAnswers] = useState<Record<string, string>>({});
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
  const questions = form?.status === 'open' ? form.questions : [];
  const visible = reachableQuestions(questions, branchAnswers);

  function selectBranch(id: string, value: string) {
    setBranchAnswers((previous) => {
      const next = { ...previous, [id]: value };
      return Object.fromEntries(
        reachableQuestions(questions, next).map((question) => [
          question.id,
          next[question.id] ?? '',
        ]),
      );
    });
  }

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
              domainOperations.submitPublicTextForm(slug, request, readAnswers(visible, fields))
            }
            saved={() => setSent(true)}
          >
            {(prefix) =>
              visible.map((question) => (
                <PublicQuestion
                  key={question.id}
                  question={question}
                  prefix={prefix}
                  value={branchAnswers[question.id] ?? ''}
                  selectBranch={selectBranch}
                />
              ))
            }
          </ActionForm>
        </>
      )}
    </main>
  );
}

function readAnswers(questions: PublicFormQuestion[], fields: FormData) {
  const answers: Record<string, string | number | string[] | File> = {};
  for (const { id, kind } of questions) {
    const input = fields.get(id);
    if (kind === 'file') {
      if (input instanceof File && input.name) answers[id] = input;
    } else if (kind === 'multi_choice') {
      answers[id] = fields.getAll(id).map(String);
    } else {
      const value = String(input ?? '').trim();
      answers[id] = kind === 'number' && value !== '' ? Number(value) : value;
    }
  }
  return answers;
}

function reachableQuestions(questions: PublicFormQuestion[], choices: Record<string, string>) {
  const reachable: PublicFormQuestion[] = [];
  let index = 0;
  while (index < questions.length) {
    const question = questions[index];
    reachable.push(question);
    const choice = choices[question.id];
    if (question.required && question.logic?.length && !choice) break;
    const destination = question.logic?.find((rule) => rule.when === choice)?.goTo;
    if (destination === FORM_BRANCH_END) break;
    const target = questions.findIndex((candidate) => candidate.id === destination);
    index = target > index ? target : index + 1;
  }
  return reachable;
}

function PublicQuestion({
  question,
  prefix,
  value,
  selectBranch,
}: {
  question: PublicFormQuestion;
  prefix: string;
  value: string;
  selectBranch: (id: string, value: string) => void;
}) {
  const { id, kind, label, required } = question;
  const inputId = prefix + id;
  if (kind === 'file') {
    return (
      <Field id={inputId} label={label}>
        <input
          id={inputId}
          name={id}
          type="file"
          accept=".pdf,application/pdf"
          required={required}
        />
        <span>PDF de até 2 MiB</span>
      </Field>
    );
  }
  if (kind === 'multi_choice')
    return (
      <fieldset className="tw:grid tw:gap-1">
        <legend>
          {label}
          {required && ' *'}
        </legend>
        {question.options?.map((option) => (
          <label key={option} className="tw:flex tw:gap-2">
            <input type="checkbox" name={id} value={option} />
            {option}
          </label>
        ))}
      </fieldset>
    );
  if (kind === 'single_choice' || kind === 'yes_no')
    return (
      <Field id={inputId} label={label}>
        <select
          id={inputId}
          name={id}
          required={required}
          value={value}
          onChange={(event) => selectBranch(id, event.currentTarget.value)}
        >
          <option value="">Selecione</option>
          {(kind === 'yes_no' ? ['Sim', 'Não'] : (question.options ?? [])).map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </Field>
    );
  return (
    <Field id={inputId} label={label}>
      {kind === 'long_text' ? (
        <textarea id={inputId} name={id} required={required} maxLength={5000} />
      ) : (
        <input
          id={inputId}
          name={id}
          required={required}
          type={kind === 'short_text' ? 'text' : kind}
          step={kind === 'number' ? 'any' : undefined}
          maxLength={kind === 'short_text' ? 5000 : undefined}
        />
      )}
    </Field>
  );
}
