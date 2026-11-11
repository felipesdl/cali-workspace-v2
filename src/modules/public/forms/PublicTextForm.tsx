import { Input, TextArea } from '../../../components/ds/field/Controls';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { skipToken, useQuery } from '@tanstack/react-query';
import { getRouteApi, Link, useRouteContext } from '@tanstack/react-router';
import { FeedbackState } from '../../../components/ds/feedback/FeedbackState';
import { Button } from '../../../components/ds/button/Button';
import { ArrowRight, ArrowUp, Check, CornerDownLeft, Paperclip, X } from 'lucide-react';
import {
  FORM_BRANCH_END,
  publicFormQuestion,
  type PublicFormQuestion,
} from '../../../api/shared/workspace/domain-operations';
import { type PublicForm } from '../../../api/shared/forms/public';
import '../../../components/cali-flow-frame.css';

const route = getRouteApi('/f/$slug');
const FORM_OPTION_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
type FormQuestionModel = Omit<PublicFormQuestion, 'id' | 'logic'> & {
  id: string;
  help?: string;
  logic?: Array<{ when: string; goTo: string }>;
};

function zodUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function requestIdForForm(slug: string) {
  const key = `cali-forms-request:${slug}`;
  try {
    const current = sessionStorage.getItem(key);
    if (current && zodUuid(current)) return current;
    const next = crypto.randomUUID();
    sessionStorage.setItem(key, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}

function clearRequestId(slug: string) {
  try {
    sessionStorage.removeItem(`cali-forms-request:${slug}`);
  } catch {
    // Session storage may be disabled; response receipt still remains server-side.
  }
}

export function PublicTextFormPage() {
  const { slug } = route.useParams();
  return <PublicTextForm key={slug} slug={slug} />;
}

function PublicTextForm({ slug }: { slug: string }) {
  const { domainOperations, publicForms } = useRouteContext({ from: '__root__' });
  const search = new URLSearchParams(window.location.search);
  const preview = search.get('previa') === '1';
  const previewCompany = search.get('company') ?? '';
  const previewForm = search.get('form') ?? '';
  const [sent, setSent] = useState(false);
  const [started, setStarted] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const stepFormRef = useRef<HTMLFormElement>(null);
  const advanceTimerRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (sent && document.activeElement === document.body) receiptRef.current?.focus();
  }, [sent]);
  const [answers, setAnswers] = useState<Record<string, string | number | string[] | File>>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const enabled = preview
    ? Boolean(domainOperations && zodUuid(previewCompany) && zodUuid(previewForm))
    : Boolean((publicForms || domainOperations) && /^[a-z0-9-]{1,100}$/.test(slug));
  const result = useQuery({
    queryKey: preview
      ? ['phase4-public-form-preview', previewCompany, previewForm]
      : ['phase4-public-text-form', slug],
    queryFn: enabled
      ? async ({ signal }): Promise<PublicForm | null> => {
          if (preview) {
            if (!domainOperations) return null;
            const draft = await domainOperations.formDraft(previewCompany, previewForm, signal);
            if (!draft) return null;
            const questions = draft.questions.map((question) =>
              publicFormQuestion.parse({
                ...question,
                options: question.options ?? undefined,
                logic: question.logic ?? undefined,
                scaleMin: question.scaleMin ?? undefined,
                scaleMax: question.scaleMax ?? undefined,
                minLabel: question.minLabel ?? undefined,
                maxLabel: question.maxLabel ?? undefined,
              }),
            );
            return {
              source: 'pilot',
              formId: draft.id,
              slug,
              status: 'open',
              title: draft.title,
              description: draft.description,
              questions,
              confirmationEnabled: false,
            };
          }
          if (publicForms) return publicForms.read(slug, signal);
          const value = await domainOperations!.readPublicTextForm(slug, signal);
          if (!value) return null;
          return {
            source: 'pilot',
            formId: '',
            slug,
            confirmationEnabled: false,
            status: value.status,
            title: value.status === 'open' ? value.title : 'Formulário CALI',
            description: value.status === 'open' ? value.description : null,
            questions: value.status === 'open' ? value.questions : [],
          };
        }
      : skipToken,
    retry: false,
    gcTime: 0,
  });
  const form = result.data;
  const registered = form?.source === 'legacy' ? form : null;
  const questions = useMemo(() => (form?.status === 'open' ? form.questions : []), [form]);
  const questionCount = questions.filter(({ kind }) => kind !== 'statement').length;
  const visible = reachableQuestions(questions, answers);
  const currentQuestion = visible[stepIndex];
  const hasNext = currentQuestion !== undefined && stepIndex < visible.length - 1;
  const atWelcome = form?.status === 'open' && !started && !sent;
  useEffect(() => {
    if (!atWelcome) return;
    function startWithEnter(event: KeyboardEvent) {
      if (event.key !== 'Enter' || event.defaultPrevented || event.isComposing) return;
      if (
        event.target instanceof Element &&
        event.target.closest('a, button, input, select, textarea, [contenteditable]')
      )
        return;
      event.preventDefault();
      setStarted(true);
    }
    window.addEventListener('keydown', startWithEnter);
    return () => window.removeEventListener('keydown', startWithEnter);
  }, [atWelcome]);

  useEffect(
    () => () => {
      if (advanceTimerRef.current !== undefined) window.clearTimeout(advanceTimerRef.current);
    },
    [],
  );

  function updateAnswer(
    id: string,
    answer: string | number | string[] | File | undefined,
    autoAdvance = false,
  ) {
    if (advanceTimerRef.current !== undefined) window.clearTimeout(advanceTimerRef.current);
    setAnswers((previous) => {
      const next = { ...previous };
      if (answer === undefined) delete next[id];
      else next[id] = answer;
      return next;
    });
    setSubmitError('');
    if (autoAdvance) {
      const nextAnswers = { ...answers };
      if (answer === undefined) delete nextAnswers[id];
      else nextAnswers[id] = answer;
      const nextVisible = reachableQuestions(questions, nextAnswers);
      const currentIndex = nextVisible.findIndex((question) => question.id === id);
      if (currentIndex >= 0 && currentIndex < nextVisible.length - 1) {
        advanceTimerRef.current = window.setTimeout(() => {
          setStepIndex((current) => (current === stepIndex ? currentIndex + 1 : current));
        }, 380);
      }
    }
  }

  function handleStepSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (advanceTimerRef.current !== undefined) window.clearTimeout(advanceTimerRef.current);
    if (!currentQuestion || isSubmitting) return;
    const answer = answers[currentQuestion.id];
    if (!validAnswer(currentQuestion, answer, Boolean(registered))) {
      setSubmitError(validationMessage(currentQuestion, answer));
      return;
    }
    setSubmitError('');
    if (hasNext) {
      setStepIndex((previous) => previous + 1);
      return;
    }
    if (preview) {
      setSent(true);
      return;
    }
    setIsSubmitting(true);
    const visited = visible.map(({ id }) => id);
    const payload = readAnswers(visible, answers);
    const submission = publicForms
      ? publicForms.submit(form!, requestIdForForm(slug), payload, visited)
      : domainOperations!
          .submitPublicTextForm(slug, requestIdForForm(slug), payload)
          .then(() => ({ confirmation: false }));
    void submission
      .then((response) => {
        clearRequestId(slug);
        setConfirmation(response.confirmation);
        setSent(true);
      })
      .catch((error) => {
        setSubmitError(
          error instanceof Error ? error.message : 'Não foi possível enviar as respostas.',
        );
      })
      .finally(() => setIsSubmitting(false));
  }

  function goBack() {
    if (stepIndex <= 0) return;
    if (advanceTimerRef.current !== undefined) window.clearTimeout(advanceTimerRef.current);
    setStepIndex((current) => current - 1);
    setSubmitError('');
  }

  useEffect(() => {
    if (!started || sent || !currentQuestion) return;
    function handleQuestionKeys(event: KeyboardEvent) {
      const target = event.target;
      const isElement = target instanceof HTMLElement;
      const isTextEntry =
        isElement &&
        (target.isContentEditable ||
          target instanceof HTMLTextAreaElement ||
          (target instanceof HTMLInputElement && target.type !== 'checkbox'));
      if (isTextEntry || event.defaultPrevented || event.isComposing) return;
      if (event.key === 'Enter' && !(target instanceof HTMLTextAreaElement && event.shiftKey)) {
        event.preventDefault();
        stepFormRef.current?.requestSubmit();
        return;
      }
      const options =
        currentQuestion.kind === 'single_choice'
          ? (currentQuestion.options ?? [])
          : currentQuestion.kind === 'yes_no'
            ? ['Sim', 'Não']
            : currentQuestion.kind === 'multi_choice'
              ? (currentQuestion.options ?? [])
              : [];
      const optionIndex = FORM_OPTION_LETTERS.indexOf(event.key.toUpperCase());
      if (optionIndex < 0 || optionIndex >= options.length) return;
      event.preventDefault();
      if (advanceTimerRef.current !== undefined) window.clearTimeout(advanceTimerRef.current);
      const id = currentQuestion.id;
      let nextAnswer: string | string[];
      if (currentQuestion.kind === 'multi_choice') {
        const selected = answers[currentQuestion.id];
        const current = Array.isArray(selected) ? selected : [];
        const option = options[optionIndex];
        nextAnswer = current.includes(option)
          ? current.filter((item) => item !== option)
          : [...current, option];
      } else {
        nextAnswer = options[optionIndex];
      }
      setAnswers((previous) => ({ ...previous, [id]: nextAnswer }));
      setSubmitError('');
      if (currentQuestion.kind !== 'multi_choice') {
        const nextVisible = reachableQuestions(questions, { ...answers, [id]: nextAnswer });
        const currentIndex = nextVisible.findIndex((question) => question.id === id);
        if (currentIndex >= 0 && currentIndex < nextVisible.length - 1) {
          advanceTimerRef.current = window.setTimeout(() => {
            setStepIndex((current) => (current === stepIndex ? currentIndex + 1 : current));
          }, 380);
        }
      }
    }
    window.addEventListener('keydown', handleQuestionKeys);
    return () => window.removeEventListener('keydown', handleQuestionKeys);
  }, [answers, currentQuestion, questions, sent, started, stepIndex]);

  const progress = sent
    ? 100
    : started && visible.length
      ? Math.round((stepIndex / visible.length) * 100)
      : 0;
  const progressTitle =
    started && visible.length
      ? `${Math.min(stepIndex + 1, visible.length)} de ${visible.length}`
      : '';

  return (
    <main className="cali-form-page">
      <div
        className={`cf-leaf ${sent ? 'cf-leaf-done' : started ? 'cf-leaf-questions' : 'cf-leaf-intro'}`}
        aria-hidden="true"
      />
      <div
        className="cf-progress"
        role="progressbar"
        aria-label="Progresso do formulário"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <i style={{ width: `${progress}%` }} />
      </div>
      <header className="cf-top">
        <img src="/brand/cali-rh-bordo.png" alt="CALI RH" />
        {preview && <span className="cf-preview">Prévia · as respostas não serão salvas</span>}
      </header>
      <section className="cf-stage">
        {enabled && result.isPending && (
          <div className="cf-screen cf-center">
            <span className="cf-spinner" aria-label="Carregando formulário" />
          </div>
        )}
        {enabled && result.isError && (
          <div className="cf-screen cf-center cf-enter">
            <small>CALI FORMS</small>
            <h1>Não foi possível abrir o formulário</h1>
            <FeedbackState kind="error" onRetry={() => void result.refetch()}>
              Tente carregar novamente.
            </FeedbackState>
          </div>
        )}
        {(!enabled || (result.isSuccess && !form)) && (
          <div className="cf-screen cf-center cf-enter">
            <small>CALI FORMS</small>
            <h1>Formulário não encontrado</h1>
            <p>Confira o link que você recebeu ou fale com a CALI RH.</p>
          </div>
        )}
        {form?.status === 'closed' && (
          <div className="cf-screen cf-center cf-enter">
            <small>CALI FORMS</small>
            <h1>{form.title}</h1>
            <p>Este formulário não está mais recebendo respostas. Obrigada pelo interesse.</p>
          </div>
        )}
        {form?.status === 'open' && !started && !sent && (
          <div className="cf-screen cf-enter cf-welcome">
            <small>{form.category || 'Formulário'}</small>
            <h1>{form.title}</h1>
            {form.description && <p className="cf-desc">{form.description}</p>}
            {preview && <p className="cf-preview-note">Prévia — respostas não serão salvas.</p>}
            <div className="cf-actions">
              <Button className="cf-primary" onClick={() => setStarted(true)}>
                Começar <ArrowRight size={18} aria-hidden="true" />
              </Button>
              <span className="cf-enter-hint">
                ou pressione{' '}
                <b>
                  Enter <CornerDownLeft size={13} aria-hidden="true" />
                </b>
              </span>
            </div>
            <p className="cf-meta">
              {questionCount} {questionCount === 1 ? 'pergunta' : 'perguntas'} · cerca de{' '}
              {Math.max(1, Math.round(questionCount * 0.4))} min
            </p>
          </div>
        )}
        {form?.status === 'open' && started && currentQuestion && !sent && (
          <form
            ref={stepFormRef}
            className={`cf-screen cf-q cf-next${currentQuestion.kind === 'statement' ? 'cf-statement' : ''}`}
            key={currentQuestion.id}
            aria-label={form.submitLabel || 'Responder formulário'}
            noValidate
            onSubmit={handleStepSubmit}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing &&
                event.target instanceof HTMLTextAreaElement
              ) {
                event.preventDefault();
                event.currentTarget.requestSubmit();
              }
            }}
          >
            <div className="cf-label">
              {currentQuestion.kind !== 'statement' && (
                <span className="cf-num">
                  {stepIndex + 1}
                  <ArrowRight size={14} aria-hidden="true" />
                </span>
              )}
              <h2 id={`public-question-${currentQuestion.id}-label`}>
                {currentQuestion.label}
                {currentQuestion.kind !== 'statement' &&
                  (currentQuestion.required ? (
                    <em className="cf-req" aria-label="obrigatória">
                      *
                    </em>
                  ) : (
                    <span className="cf-optional">Opcional</span>
                  ))}
              </h2>
            </div>
            {currentQuestion.help && (
              <p className="cf-help" id={`public-question-${currentQuestion.id}-help`}>
                {currentQuestion.help}
              </p>
            )}
            {visible.some(({ kind }) => kind === 'name' || kind === 'email' || kind === 'phone') &&
              stepIndex === 0 && (
                <p className="cf-privacy-note">
                  Os dados de contato informados ficam disponíveis à administração do formulário.
                </p>
              )}
            <PublicQuestion
              question={currentQuestion}
              value={answers[currentQuestion.id]}
              updateAnswer={(value, autoAdvance) =>
                updateAnswer(currentQuestion.id, value, autoAdvance)
              }
              registered={Boolean(registered)}
            />
            {submitError && (
              <p className="cf-error" role="alert">
                {submitError}
              </p>
            )}
            <div className="cf-actions">
              {stepIndex > 0 && (
                <Button
                  variant="secondary"
                  className="cf-nav-back"
                  onClick={goBack}
                  aria-label="Voltar"
                >
                  <ArrowUp size={18} aria-hidden="true" />
                </Button>
              )}
              <Button type="submit" className="cf-primary" pending={isSubmitting}>
                {isSubmitting ? 'Enviando…' : hasNext ? 'Continuar' : form.submitLabel || 'Enviar'}
                {hasNext ? (
                  <ArrowRight size={18} aria-hidden="true" />
                ) : (
                  <Check size={18} aria-hidden="true" />
                )}
              </Button>
              <span className="cf-enter-hint">
                pressione{' '}
                <b>
                  Enter <CornerDownLeft size={13} aria-hidden="true" />
                </b>
              </span>
            </div>
            <div className="cf-step-progress" aria-live="polite">
              {progressTitle}
            </div>
          </form>
        )}
        {sent && form && (
          <div className="cf-screen cf-center cf-enter cf-done" ref={receiptRef} tabIndex={-1}>
            <span className="cf-done-mark">
              <img src="/brand/cali-oak-mark-light.svg" alt="" />
            </span>
            {preview ? (
              <>
                <h1>Prévia concluída.</h1>
                <p>Nenhuma resposta foi salva.</p>
              </>
            ) : (
              <SuccessCopy value={form.successText || form.thankYou} />
            )}
            {!preview && confirmation && (
              <p>Uma cópia da resposta foi solicitada para o e-mail informado.</p>
            )}
          </div>
        )}
      </section>
      <footer className="cf-foot">
        <a href="https://calirh.com" target="_blank" rel="noopener noreferrer">
          CALI RH
        </a>
        <span>·</span>
        <Link to="/privacidade">Privacidade</Link>
      </footer>
    </main>
  );
}

function readAnswers(
  questions: FormQuestionModel[],
  values: Record<string, string | number | string[] | File>,
) {
  const answers: Record<string, string | number | string[] | File> = {};
  for (const { id, kind } of questions) {
    if (kind === 'statement') continue;
    const answer = values[id];
    if (answer !== undefined) answers[id] = answer;
  }
  return answers;
}

function reachableQuestions(
  questions: FormQuestionModel[],
  answers: Record<string, string | number | string[] | File>,
) {
  const reachable: FormQuestionModel[] = [];
  let index = 0;
  while (index < questions.length) {
    const question = questions[index];
    reachable.push(question);
    const choice = typeof answers[question.id] === 'string' ? answers[question.id] : undefined;
    if (question.required && question.logic?.length && !choice) break;
    const destination = question.logic?.find((rule) => rule.when === choice)?.goTo;
    if (destination === FORM_BRANCH_END) break;
    const target = questions.findIndex((candidate) => candidate.id === destination);
    index = target > index ? target : index + 1;
  }
  return reachable;
}

function validAnswer(
  question: FormQuestionModel,
  value: string | number | string[] | File | undefined,
  registered: boolean,
) {
  if (question.kind === 'statement') return true;
  const empty = value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
  if (empty) return !question.required;
  if (question.kind === 'email' && typeof value === 'string')
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());
  if (question.kind === 'phone' && typeof value === 'string')
    return value.replace(/\D/g, '').length >= 8;
  if (question.kind === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (question.kind === 'scale') {
    return (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= (question.scaleMin ?? 0) &&
      value <= (question.scaleMax ?? 10)
    );
  }
  if (question.kind === 'single_choice' || question.kind === 'yes_no') {
    const allowed = question.kind === 'yes_no' ? ['Sim', 'Não'] : (question.options ?? []);
    return typeof value === 'string' && allowed.includes(value);
  }
  if (question.kind === 'multi_choice') {
    return Array.isArray(value) && value.every((item) => question.options?.includes(item));
  }
  if (question.kind === 'file') {
    if (!(value instanceof File) || value.size === 0) return false;
    if (registered) {
      const accepted =
        question.accept === 'images_pdf'
          ? ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']
          : null;
      return value.size <= 25 * 1024 * 1024 && (!accepted || accepted.includes(value.type));
    }
    return value.size <= 2 * 1024 * 1024 && value.name.toLowerCase().endsWith('.pdf');
  }
  return typeof value === 'string' && value.length <= 5000;
}

function validationMessage(
  question: FormQuestionModel,
  value: string | number | string[] | File | undefined,
) {
  if (question.kind === 'email') return 'Confira o e-mail digitado.';
  if (question.kind === 'phone') return 'Confira o telefone informado.';
  if (question.kind === 'file') return 'Confira o arquivo selecionado e o limite de tamanho.';
  if (question.kind === 'number' || question.kind === 'scale') return 'Informe um número válido.';
  if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
    return 'Esta pergunta é obrigatória.';
  }
  return 'Confira a resposta informada.';
}

function SuccessCopy({ value }: { value: string | null | undefined }) {
  const message = value?.trim();
  if (!message) {
    return (
      <>
        <h1>Muito obrigado!</h1>
        <p>Recebemos suas respostas e agradecemos a colaboração.</p>
      </>
    );
  }
  const match = message.match(/^(.{4,70}?[!.?])\s+(.+)$/s);
  return match ? (
    <>
      <h1>{match[1]}</h1>
      <p>{match[2]}</p>
    </>
  ) : (
    <>
      <h1>Muito obrigado!</h1>
      <p>{message}</p>
    </>
  );
}

const inputSettings = {
  name: {
    type: 'text',
    autoComplete: 'name',
    maxLength: 300,
    placeholder: 'Digite sua resposta aqui…',
  },
  email: { type: 'email', autoComplete: 'email', maxLength: 254, placeholder: 'nome@empresa.com' },
  phone: { type: 'tel', autoComplete: 'tel', maxLength: 40, placeholder: '(11) 90000-0000' },
  short_text: { type: 'text', maxLength: 300, placeholder: 'Digite sua resposta aqui…' },
  number: { type: 'number', step: 'any', placeholder: 'Digite um número' },
  date: { type: 'date' },
};

function PublicQuestion({
  question,
  value,
  updateAnswer,
  registered,
}: {
  question: FormQuestionModel;
  value: string | number | string[] | File | undefined;
  updateAnswer: (
    value: string | number | string[] | File | undefined,
    autoAdvance?: boolean,
  ) => void;
  registered: boolean;
}) {
  const { id, kind } = question;
  const inputId = `public-question-${id}`;
  const labelId = `${inputId}-label`;
  const helpId = `${inputId}-help`;
  const describedBy = question.help ? helpId : undefined;
  if (kind === 'statement') return null;
  if (kind === 'scale') {
    const { scaleMin = 0, scaleMax = 10, minLabel, maxLabel } = question;
    const options = Array.from({ length: scaleMax - scaleMin + 1 }, (_, i) => scaleMin + i);
    return (
      <div
        className="cf-scale-wrap"
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={describedBy}
      >
        <div
          className="cf-scale"
          style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
        >
          {options.map((score) => (
            <button
              type="button"
              role="radio"
              aria-checked={value === score}
              key={score}
              className={value === score ? 'on' : ''}
              onClick={() => updateAnswer(score, true)}
            >
              {score}
            </button>
          ))}
        </div>
        {(minLabel || maxLabel) && (
          <div className="cf-scale-labels">
            <span>{minLabel}</span>
            <span>{maxLabel}</span>
          </div>
        )}
      </div>
    );
  }
  if (kind === 'file') {
    return (
      <div className="cf-file" aria-describedby={describedBy}>
        {value instanceof File ? (
          <div className="cf-file-chosen">
            <span className="cf-file-icon">
              <Paperclip size={20} aria-hidden="true" />
            </span>
            <span>
              <strong>{value.name}</strong>
              <small>Arquivo pronto</small>
            </span>
            <button
              type="button"
              aria-label="Remover arquivo"
              onClick={() => updateAnswer(undefined)}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <label className="cf-file-drop" htmlFor={inputId}>
            <Input
              id={inputId}
              name={id}
              type="file"
              className="cf-file-native"
              aria-labelledby={labelId}
              aria-describedby={describedBy}
              accept={
                registered
                  ? question.accept === 'images_pdf'
                    ? '.pdf,image/png,image/jpeg,image/webp,image/gif'
                    : undefined
                  : '.pdf,application/pdf'
              }
              onChange={(event) => updateAnswer(event.currentTarget.files?.[0])}
            />
            <Paperclip size={22} aria-hidden="true" />
            <strong>Escolher arquivo</strong>
            <small>
              {registered
                ? question.accept === 'images_pdf'
                  ? 'PDF ou imagem · até 25 MiB'
                  : 'Arquivo · até 25 MiB'
                : 'PDF · até 2 MiB'}
            </small>
          </label>
        )}
      </div>
    );
  }
  if (kind === 'multi_choice')
    return (
      <div
        className="cf-options"
        role="group"
        aria-labelledby={labelId}
        aria-describedby={describedBy}
      >
        <p className="cf-hint">Escolha quantas quiser</p>
        {question.options?.map((option, position) => {
          const selected = Array.isArray(value) && value.includes(option);
          return (
            <button
              type="button"
              role="checkbox"
              aria-checked={selected}
              className={selected ? 'on' : ''}
              key={option}
              onClick={() => {
                const current = Array.isArray(value) ? value : [];
                updateAnswer(
                  selected ? current.filter((item) => item !== option) : [...current, option],
                );
              }}
            >
              <kbd>{String.fromCharCode(65 + position)}</kbd>
              <span>{option}</span>
              {selected && <Check size={18} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    );
  if (kind === 'single_choice' || kind === 'yes_no') {
    const options = kind === 'yes_no' ? ['Sim', 'Não'] : (question.options ?? []);
    return (
      <div
        className={`cf-options${kind === 'yes_no' ? 'cf-options-row' : ''}`}
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={describedBy}
      >
        {options.map((option, position) => (
          <button
            type="button"
            role="radio"
            aria-checked={value === option}
            className={value === option ? 'on' : ''}
            key={option}
            onClick={() => updateAnswer(option, true)}
          >
            <kbd>{String.fromCharCode(65 + position)}</kbd>
            <span>{option}</span>
            {value === option && <Check size={18} aria-hidden="true" />}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="cf-answer-input" aria-describedby={describedBy}>
      {kind === 'long_text' ? (
        <TextArea
          id={inputId}
          name={id}
          aria-labelledby={labelId}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => updateAnswer(event.currentTarget.value)}
          maxLength={5000}
          placeholder="Digite sua resposta aqui…"
          className="cf-text cf-long"
        />
      ) : (
        <Input
          id={inputId}
          name={id}
          aria-labelledby={labelId}
          value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
          onChange={(event) => {
            const text = event.currentTarget.value;
            updateAnswer(kind === 'number' ? (text === '' ? undefined : Number(text)) : text);
          }}
          className="cf-text"
          {...inputSettings[kind]}
        />
      )}
    </div>
  );
}
