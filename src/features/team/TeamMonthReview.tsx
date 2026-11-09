import { FormActions } from '../../components/ds/button/FormActions';
import { FeedbackMessage } from '../../components/ds/feedback/FeedbackMessage';
import { Input, Select, TextArea } from '../../components/ds/field/Controls';
import { useId, useState } from 'react';
import { z } from 'zod';
import {
  monthlyVacancy,
  vacancyStatus,
  type MonthlyReviewState,
  type MonthlyVacancy,
} from '../../api/modules/team/monthly-review';
import { type MonthlyState } from '../../api/modules/team/monthly';
import { type useTeamMonthly } from '../../api/modules/team/useTeamMonthly';
import { writeMonthOptions } from '../../api/modules/team/maintenance';
import { type TeamSearch, teamViews } from '../../api/modules/team/schemas';
import { Button } from '../../components/ds/button/Button';
import { Checkbox } from '../../components/ds/checkbox/Checkbox';
import { Field } from '../../components/ds/field/Field';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { formatServerInstant } from '../../lib/dates';

const vacancyLabels = {
  open: 'Em andamento',
  filled: 'Preenchida',
  cancelled: 'Cancelada',
} as const;
const answerLabels: Readonly<Record<string, string>> = {
  admissions: 'Admissões',
  departures: 'Desligamentos',
  changes: 'Mudanças internas',
  vacancies: 'Vagas acompanhadas',
};

function ReviewEditor({
  state,
  pending,
  needsReason,
  onConfirm,
  onCancel,
  navigate,
}: {
  state: MonthlyReviewState;
  pending: boolean;
  needsReason: boolean;
  onConfirm: (
    vacancies: MonthlyVacancy[],
    token: string,
    reason: string,
    requestId: string,
  ) => Promise<void>;
  onCancel: () => void;
  navigate: (update: Partial<TeamSearch>) => void;
}) {
  const id = useId();
  const [original] = useState(state);
  const [requestId] = useState(() => crypto.randomUUID());
  const [jobs, setJobs] = useState(original.vacancies);
  const [error, setError] = useState('');
  const initialCodes = new Set(original.vacancies.map((job) => job.vacancy_code));
  function update(code: string, patch: Partial<MonthlyVacancy>) {
    setJobs((rows) => rows.map((row) => (row.vacancy_code === code ? { ...row, ...patch } : row)));
  }
  return (
    <form
      aria-label="Confirmar dados do mês"
      className="tw:grid tw:min-w-0 tw:gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setError('');
        const form = new FormData(event.currentTarget);
        try {
          if (!form.has('checked'))
            throw new Error('Confirme a conferência do quadro e das vagas.');
          await onConfirm(
            z.array(monthlyVacancy).max(200).parse(jobs),
            original.token,
            z.string().parse(form.get('reason') ?? ''),
            requestId,
          );
        } catch (cause) {
          setError(
            cause instanceof z.ZodError
              ? 'Confira títulos, datas e situação das vagas.'
              : cause instanceof Error
                ? cause.message
                : 'Não foi possível confirmar o mês.',
          );
        }
      }}
    >
      <fieldset
        disabled={pending}
        className="tw:m-0 tw:grid tw:min-w-0 tw:gap-3 tw:border-0 tw:p-0"
      >
        <legend className="tw:font-bold">Quadro conferido</legend>
        <p>
          {original.draftPeople}{' '}
          {original.draftPeople === 1 ? 'pessoa será incluída' : 'pessoas serão incluídas'} no
          quadro desta referência.
        </p>
        <p className="tw:text-caption">
          Registre admissões, saídas e alterações na ficha antes da confirmação. O histórico do
          cadastro e as referências anteriores ficam preservados.
        </p>
        <Button
          variant="secondary"
          onClick={() => navigate({ view: teamViews.Directory, member: undefined, page: 1 })}
        >
          Consultar cadastro e movimentações
        </Button>
      </fieldset>
      <fieldset
        disabled={pending}
        className="tw:m-0 tw:grid tw:min-w-0 tw:gap-4 tw:border-0 tw:p-0"
      >
        <legend className="tw:font-bold">Vagas acompanhadas</legend>
        {original.vacancyTotal > original.vacancies.length && (
          <p className="tw:text-caption">
            Exibindo as primeiras {original.vacancies.length} de {original.vacancyTotal} vagas. As
            demais ficam preservadas.
          </p>
        )}
        {jobs.map((job) => (
          <div
            className="tw:grid tw:min-w-0 tw:grid-cols-2 tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:p-3 tw:mobile:grid-cols-1"
            key={job.vacancy_code}
          >
            <Field id={`${id}-${job.vacancy_code}-title`} label="Nome da vaga">
              <Input
                id={`${id}-${job.vacancy_code}-title`}
                value={job.title}
                required
                maxLength={180}
                onChange={(event) => update(job.vacancy_code, { title: event.target.value })}
              />
            </Field>
            <Field id={`${id}-${job.vacancy_code}-department`} label="Departamento">
              <Input
                id={`${id}-${job.vacancy_code}-department`}
                value={job.department ?? ''}
                maxLength={180}
                onChange={(event) =>
                  update(job.vacancy_code, { department: event.target.value || null })
                }
              />
            </Field>
            <Field id={`${id}-${job.vacancy_code}-opened`} label="Aberta em">
              <Input
                id={`${id}-${job.vacancy_code}-opened`}
                type="date"
                required
                readOnly={initialCodes.has(job.vacancy_code)}
                value={job.opened_on}
                onChange={(event) => update(job.vacancy_code, { opened_on: event.target.value })}
              />
            </Field>
            <Field id={`${id}-${job.vacancy_code}-status`} label="Situação da vaga">
              <Select
                id={`${id}-${job.vacancy_code}-status`}
                value={job.status}
                onChange={(event) => {
                  const status = z.enum(vacancyStatus).parse(event.target.value);
                  update(job.vacancy_code, {
                    status,
                    ...(status === vacancyStatus.Open ? { closed_on: null } : {}),
                  });
                }}
              >
                {Object.entries(vacancyLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            {job.status !== vacancyStatus.Open && (
              <Field id={`${id}-${job.vacancy_code}-closed`} label="Encerrada em">
                <Input
                  id={`${id}-${job.vacancy_code}-closed`}
                  type="date"
                  required
                  min={job.opened_on}
                  value={job.closed_on ?? ''}
                  onChange={(event) =>
                    update(job.vacancy_code, { closed_on: event.target.value || null })
                  }
                />
              </Field>
            )}
            {!initialCodes.has(job.vacancy_code) && (
              <Button
                variant="secondary"
                onClick={() =>
                  setJobs((rows) => rows.filter((row) => row.vacancy_code !== job.vacancy_code))
                }
              >
                Remover nova vaga
              </Button>
            )}
          </div>
        ))}
        <Button
          variant="secondary"
          disabled={jobs.length >= 200}
          onClick={() =>
            setJobs((rows) => [
              ...rows,
              {
                vacancy_code: `VAGA-${crypto.randomUUID()}`,
                title: '',
                department: null,
                opened_on: '',
                status: vacancyStatus.Open,
                closed_on: null,
              },
            ])
          }
        >
          Adicionar vaga
        </Button>
        <p className="tw:text-caption tw:text-muted-copy">
          Vagas ausentes desta conferência continuam cadastradas. Confirmar um mês sem pessoas ou
          vagas também é permitido.
        </p>
      </fieldset>
      {needsReason && (
        <Field id={`${id}-reason`} label="Motivo da revisão">
          <TextArea
            id={`${id}-reason`}
            name="reason"
            required
            minLength={3}
            maxLength={500}
            disabled={pending}
          />
        </Field>
      )}
      <Checkbox name="checked" disabled={pending}>
        Conferi o quadro e as vagas desta referência.
      </Checkbox>
      {error && <FeedbackState kind="error">{error}</FeedbackState>}
      <FormActions className="tw:max-w-md">
        <Button type="submit" pending={pending}>
          Confirmar mês
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onCancel}>
          Cancelar conferência
        </Button>
      </FormActions>
    </form>
  );
}

export function TeamMonthReview({
  monthly,
  data,
  navigate,
}: {
  monthly: ReturnType<typeof useTeamMonthly>;
  data: MonthlyState;
  navigate: (update: Partial<TeamSearch>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  if (monthly.review.isPending)
    return <FeedbackState kind="loading">Carregando conferência do mês…</FeedbackState>;
  if (monthly.review.isError)
    return (
      <FeedbackState kind="error" onRetry={() => void monthly.review.refetch()}>
        Não foi possível carregar a conferência do mês.
      </FeedbackState>
    );
  const state = monthly.review.data;
  if (!state) return null;
  const writable = writeMonthOptions().includes(monthly.month.slice(0, 7));
  return (
    <section
      aria-label="Confirmação mensal"
      className="tw:grid tw:gap-4 tw:border-t tw:border-border-default tw:pt-4"
    >
      <h3 className="tw:m-0 tw:text-section tw:font-bold">Confirmação mensal</h3>
      {message && <FeedbackMessage tone="success">{message}</FeedbackMessage>}
      {data.review ? (
        <p>
          Referência confirmada em {formatServerInstant(data.review.confirmedAt)}. Revisão{' '}
          {data.review.revision}.
        </p>
      ) : (
        <p>
          {monthly.admin
            ? 'Aguardando conferência do Cliente.'
            : 'Confira o quadro e as vagas para confirmar esta referência.'}
        </p>
      )}
      {editing ? (
        <ReviewEditor
          state={state}
          pending={monthly.confirm.isPending}
          needsReason={monthly.admin && Boolean(data.review)}
          navigate={navigate}
          onCancel={() => setEditing(false)}
          onConfirm={async (vacancies, token, reason, requestId) => {
            const result = await monthly.confirm.mutateAsync({
              vacancies,
              token,
              reason,
              requestId,
            });
            setEditing(false);
            setMessage(`Mês confirmado. Revisão ${result.revision}.`);
          }}
        />
      ) : (
        <>
          {writable && (!monthly.admin || data.review) && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              {data.review ? 'Conferir referência novamente' : 'Conferir e confirmar mês'}
            </Button>
          )}
          <ul className="tw:m-0 tw:pl-5">
            {Object.entries(data.review?.answers ?? {}).map(([key, value]) => (
              <li key={key}>
                {answerLabels[key] ?? key}: {value}
              </li>
            ))}
          </ul>
          <div aria-label="Histórico das confirmações">
            {data.events
              .filter((event) => event.domain === 'review')
              .map((event) => (
                <p key={event.id} className="tw:text-caption">
                  Confirmação {event.revision} · {formatServerInstant(event.recorded_at)}
                  {event.reason ? ` · ${event.reason}` : ''}
                </p>
              ))}
          </div>
        </>
      )}
    </section>
  );
}
