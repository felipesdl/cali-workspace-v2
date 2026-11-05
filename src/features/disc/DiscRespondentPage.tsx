import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { z } from 'zod';
import { useDiscPublic, useDiscPublicCommand } from '../../api/modules/disc/hooks';
import { Button } from '../../components/ds/button/Button';
import { Checkbox } from '../../components/ds/checkbox/Checkbox';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { Field } from '../../components/ds/field/Field';
import {
  BANK,
  hasDistinctChoices,
  orderedChoices,
  PRESSURE_BLOCKS,
  type DiscBlockAnswer,
  type DiscChoice,
} from './questionnaire';

const inviteTokenSchema = z.uuid();
type AnswerSet = Record<string, DiscBlockAnswer>;
type SubmissionIdentity = { fingerprint: string; requestId: string };

function answerKey(block: number, pressure: boolean) {
  return `${pressure ? 'pressure' : 'natural'}:${block}`;
}

function formatDeadline(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

export function DiscRespondentPage() {
  const params = useParams({ strict: false });
  const parsedToken = inviteTokenSchema.safeParse(params.token);
  const token = parsedToken.success ? parsedToken.data : '';
  const query = useDiscPublic(token);
  const command = useDiscPublicCommand(token);
  const openedToken = useRef('');
  const submissionIdentity = useRef<SubmissionIdentity | null>(null);
  const [consent, setConsent] = useState(false);
  const [started, setStarted] = useState(false);
  const [jobTitle, setJobTitle] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerSet>({});
  const [submitted, setSubmitted] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!parsedToken.success || query.data?.state !== 'sent' || openedToken.current === token)
      return;
    openedToken.current = token;
    void command.mutateAsync({ kind: 'open', fields: {} }).catch(() => {
      openedToken.current = '';
    });
  }, [command, parsedToken.success, query.data?.state, token]);

  const questionCount = BANK.length + PRESSURE_BLOCKS.length;
  const pressure = currentIndex >= BANK.length;
  const block = pressure ? PRESSURE_BLOCKS[currentIndex - BANK.length] : BANK[currentIndex]?.block;
  const question = block === undefined ? undefined : BANK[block - 1];
  const currentAnswer = question ? answers[answerKey(question.block, pressure)] : undefined;
  const completeCount = useMemo(
    () => Object.values(answers).filter(hasDistinctChoices).length,
    [answers],
  );
  const canSubmit = completeCount === questionCount && consent;
  const deadline = query.data?.deadline_at ? formatDeadline(query.data.deadline_at) : null;

  function setChoice(which: 'mais' | 'menos', choice: DiscChoice) {
    if (!question) return;
    const key = answerKey(question.block, pressure);
    setAnswers((current) => {
      const prior = current[key] ?? { b: question.block, mais: null, menos: null };
      const next = { ...prior, [which]: prior[which] === choice ? null : choice };
      const other = which === 'mais' ? 'menos' : 'mais';
      if (next[which] && next[which] === next[other]) next[other] = null;
      return { ...current, [key]: next };
    });
    setMessage('');
  }

  async function moveNext() {
    if (!question || !hasDistinctChoices(currentAnswer)) {
      setMessage('Escolha uma frase que combina mais e outra que combina menos.');
      return;
    }
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    setMessage('');
    if (
      query.data?.state === 'sent' ||
      query.data?.state === 'opened' ||
      query.data?.state === 'started'
    ) {
      try {
        await command.mutateAsync({ kind: 'progress', fields: { block: nextIndex } });
      } catch {
        // Progresso é acompanhamento; resposta continua na memória desta sessão.
      }
    }
  }

  async function submit() {
    if (!canSubmit || command.isPending) return;
    const pack = (blocks: readonly number[], isPressure: boolean) => {
      const packed: Array<{ b: number; mais: DiscChoice; menos: DiscChoice }> = [];
      for (const responseBlock of blocks) {
        const answer = answers[answerKey(responseBlock, isPressure)];
        if (!hasDistinctChoices(answer)) return null;
        packed.push({ b: responseBlock, mais: answer.mais, menos: answer.menos });
      }
      return packed;
    };
    const natural = pack(
      BANK.map(({ block: itemBlock }) => itemBlock),
      false,
    );
    const pressureAnswers = pack(PRESSURE_BLOCKS, true);
    if (!natural || !pressureAnswers) {
      setMessage(
        'Revise as respostas: escolha uma opção como mais e outra como menos em cada bloco.',
      );
      return;
    }
    const fingerprint = JSON.stringify({
      jobTitle: jobTitle.trim(),
      answers: { natural, pressure: pressureAnswers },
      consent,
    });
    if (submissionIdentity.current?.fingerprint !== fingerprint) {
      submissionIdentity.current = { fingerprint, requestId: crypto.randomUUID() };
    }

    setMessage('');
    try {
      await command.mutateAsync({
        kind: 'submit',
        fields: {
          jobTitle: jobTitle.trim(),
          consent: true,
          answers: { natural, pressure: pressureAnswers },
          requestId: submissionIdentity.current.requestId,
        },
      });
      setSubmitted(true);
    } catch {
      setMessage('Não foi possível registrar agora. Tente novamente.');
    }
  }

  async function decline() {
    try {
      await command.mutateAsync({ kind: 'decline', fields: {} });
      setDeclined(true);
    } catch {
      setMessage('Não foi possível encerrar o convite agora. Tente novamente.');
    }
  }

  if (!parsedToken.success)
    return (
      <StatusPage title="Convite inválido">Confira o link recebido e tente novamente.</StatusPage>
    );
  if (query.isPending)
    return (
      <StatusPage>
        <FeedbackState kind="loading">Confirmando seu convite…</FeedbackState>
      </StatusPage>
    );
  if (query.isError) {
    return (
      <StatusPage>
        <FeedbackState kind="error" onRetry={() => void query.refetch()}>
          Não foi possível carregar o convite.
        </FeedbackState>
      </StatusPage>
    );
  }

  const state = query.data?.state ?? 'missing';
  if (submitted || state === 'completed') {
    return (
      <StatusPage title="Obrigado por participar">Suas respostas foram registradas.</StatusPage>
    );
  }
  if (declined || state === 'declined') {
    return (
      <StatusPage title="Convite encerrado">Este convite foi encerrado a seu pedido.</StatusPage>
    );
  }
  if (state === 'expired') {
    return (
      <StatusPage title="Convite expirado">
        O prazo terminou. Fale com a pessoa que enviou o convite.
      </StatusPage>
    );
  }
  if (state === 'missing')
    return (
      <StatusPage title="Convite não encontrado">
        Confira o link recebido e tente novamente.
      </StatusPage>
    );
  if (state === 'closed')
    return (
      <StatusPage title="Convite indisponível">
        Este convite não está recebendo respostas.
      </StatusPage>
    );
  if (state === 'created' || state === 'queued') {
    return (
      <StatusPage title="Convite ainda não liberado">
        Aguarde o e-mail de liberação para responder.
      </StatusPage>
    );
  }
  if (!['open', 'sent', 'opened', 'started'].includes(state)) {
    return (
      <StatusPage title="Convite indisponível">
        Este convite não está disponível para resposta.
      </StatusPage>
    );
  }

  return (
    <main className="sm:tw:px-6 tw:min-h-screen tw:bg-ivory tw:px-4 tw:py-8 tw:text-copy">
      <section className="sm:tw:p-10 tw:mx-auto tw:grid tw:w-full tw:max-w-3xl tw:gap-6 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-6 tw:shadow-sm">
        <header className="tw:grid tw:gap-2">
          <p className="tw:text-caption tw:font-bold tw:tracking-widest tw:text-brand">
            CALI · PERFIL COMPORTAMENTAL
          </p>
          <h1 className="tw:text-section tw:font-bold tw:text-brand">
            {query.data?.title ?? 'Questionário'}
          </h1>
          {query.data?.organization && <p className="tw:text-body">{query.data.organization}</p>}
          {query.data?.person_name && (
            <p className="tw:text-body">Convite para {query.data.person_name}</p>
          )}
          {deadline && <p className="tw:text-caption">Prazo: {deadline} (horário de Brasília)</p>}
        </header>

        {!started ? (
          <div className="tw:grid tw:gap-5">
            <p className="tw:text-body tw:leading-relaxed">
              Este formulário usa dados sintéticos para validar o fluxo. Não informe respostas,
              nomes ou situações reais.
            </p>
            {(query.data?.last_block ?? 0) > 0 && (
              <p className="tw:text-caption">
                Andamento anterior registrado até o bloco {query.data?.last_block}. As respostas não
                são recuperadas ao reabrir a página.
              </p>
            )}
            <Checkbox
              checked={consent}
              onChange={(event) => setConsent(event.currentTarget.checked)}
            >
              Confirmo o uso de dados sintéticos e concordo com o registro das respostas
              exclusivamente para validar este fluxo.
            </Checkbox>
            <div className="tw:flex tw:flex-wrap tw:gap-3">
              <Button disabled={!consent} onClick={() => setStarted(true)}>
                Começar questionário
              </Button>
              <Button
                variant="secondary"
                pending={command.isPending}
                onClick={() => void decline()}
              >
                Não quero responder
              </Button>
            </div>
          </div>
        ) : currentIndex < questionCount && question ? (
          <div className="tw:grid tw:gap-5" aria-live="polite">
            <div className="tw:grid tw:gap-2">
              <p className="tw:text-caption tw:font-semibold tw:text-brand">
                {pressure ? 'Pensando em uma semana difícil' : 'Pensando no seu dia a dia'} · Bloco{' '}
                {currentIndex + 1} de {questionCount}
              </p>
              <div
                className="tw:h-2 tw:overflow-hidden tw:rounded-full tw:bg-border-default"
                role="progressbar"
                aria-label="Progresso do questionário"
                aria-valuemin={0}
                aria-valuemax={questionCount}
                aria-valuenow={completeCount}
              >
                <div
                  className="tw:h-full tw:bg-action-primary"
                  style={{ width: `${(completeCount / questionCount) * 100}%` }}
                />
              </div>
            </div>
            <h2 className="tw:text-subsection tw:font-bold">
              Escolha uma frase que combina mais e outra que combina menos com você.
            </h2>
            <div className="tw:grid tw:gap-3">
              {orderedChoices(question, pressure).map(({ id, text }) => {
                const moreSelected = currentAnswer?.mais === id;
                const lessSelected = currentAnswer?.menos === id;
                return (
                  <article
                    key={`${question.block}-${id}`}
                    className="sm:tw:grid-cols-[1fr_auto_auto] sm:tw:items-center tw:grid tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:p-4"
                  >
                    <p className="tw:m-0 tw:text-body">{text}</p>
                    <Button
                      variant={moreSelected ? 'primary' : 'secondary'}
                      aria-pressed={moreSelected}
                      aria-label={`${text}: combina mais`}
                      onClick={() => setChoice('mais', id)}
                    >
                      Combina mais
                    </Button>
                    <Button
                      variant={lessSelected ? 'primary' : 'secondary'}
                      aria-pressed={lessSelected}
                      aria-label={`${text}: combina menos`}
                      onClick={() => setChoice('menos', id)}
                    >
                      Combina menos
                    </Button>
                  </article>
                );
              })}
            </div>
            {message && (
              <p role="alert" className="tw:text-body tw:text-action-primary">
                {message}
              </p>
            )}
            <div className="tw:flex tw:justify-between tw:gap-3">
              <Button
                variant="secondary"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
              >
                Voltar
              </Button>
              <Button onClick={() => void moveNext()}>
                {currentIndex + 1 === questionCount ? 'Revisar respostas' : 'Continuar'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="tw:grid tw:gap-5">
            <h2 className="tw:text-subsection tw:font-bold">Revise antes de enviar</h2>
            <p className="tw:text-body">
              Blocos respondidos: {completeCount} de {questionCount}.
            </p>
            <Field id="disc-job-title" label="Cargo ou função (opcional)">
              <input
                id="disc-job-title"
                maxLength={200}
                value={jobTitle}
                onChange={(event) => setJobTitle(event.currentTarget.value)}
              />
            </Field>
            <Checkbox
              checked={consent}
              onChange={(event) => setConsent(event.currentTarget.checked)}
            >
              Confirmo novamente o uso de dados sintéticos e concordo com o registro das respostas
              exclusivamente para validar este fluxo.
            </Checkbox>
            {message && (
              <p role="alert" className="tw:text-body tw:text-action-primary">
                {message}
              </p>
            )}
            <div className="tw:flex tw:flex-wrap tw:gap-3">
              <Button variant="secondary" onClick={() => setCurrentIndex(questionCount - 1)}>
                Voltar ao questionário
              </Button>
              <Button
                pending={command.isPending}
                disabled={!canSubmit}
                onClick={() => void submit()}
              >
                Enviar respostas
              </Button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function StatusPage({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <main className="tw:grid tw:min-h-screen tw:place-items-center tw:bg-ivory tw:p-4 tw:text-copy">
      <section className="sm:tw:p-10 tw:grid tw:w-full tw:max-w-xl tw:gap-4 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-6">
        <p className="tw:text-caption tw:font-bold tw:tracking-widest tw:text-brand">
          CALI · PERFIL COMPORTAMENTAL
        </p>
        {title && <h1 className="tw:text-section tw:font-bold tw:text-brand">{title}</h1>}
        {children}
      </section>
    </main>
  );
}
