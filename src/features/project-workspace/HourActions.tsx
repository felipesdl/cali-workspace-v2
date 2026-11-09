import { FeedbackMessage } from '../../components/ds/feedback/FeedbackMessage';
import { Input, Select, TextArea } from '../../components/ds/field/Controls';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useRouteContext } from '@tanstack/react-router';
import {
  type HourAction,
  type HourCorrection,
} from '../../api/modules/project-workspace/operations';
import { Button } from '../../components/ds/button/Button';
import { CheckboxInput, Checkbox } from '../../components/ds/checkbox/Checkbox';
import { Field } from '../../components/ds/field/Field';
import { formatServerInstant } from '../../lib/dates';
import { useState } from 'react';
import { ActionForm } from './ActionForm';
import { workspaceSearch } from '../../api/modules/project-workspace/schemas';

export function HourCapacityAction({
  company,
  actor,
  month,
  version,
  paused,
}: {
  company: string;
  actor?: string;
  month: string;
  version: string | null;
  paused: boolean;
}) {
  const { hourOperations } = useRouteContext({ from: '__root__' });
  const cache = useQueryClient();
  if (!hourOperations) return null;
  return (
    <ActionForm
      label={paused ? 'Registrar retomada' : 'Registrar pausa por capacidade'}
      submit={async (_, request) => {
        try {
          return await hourOperations.setCapacityPause(company, month, request, version, !paused);
        } finally {
          await cache.invalidateQueries({ queryKey: ['hours', actor, company, month] });
        }
      }}
    >
      {() => (
        <Checkbox required>
          {paused ? 'Confirmo a retomada neste mês.' : 'Confirmo a pausa para o mês selecionado.'}
        </Checkbox>
      )}
    </ActionForm>
  );
}

export function HourEntryCorrection({
  company,
  actor,
  entry,
  version,
  day,
  minutes,
  description,
  visible,
}: {
  company: string;
  actor?: string;
  entry: string;
  version: string;
  day: string;
  minutes: number;
  description: string;
  visible: boolean;
}) {
  const { hourOperations } = useRouteContext({ from: '__root__' });
  const cache = useQueryClient();
  if (!hourOperations) return null;
  const operations = hourOperations;
  async function submit(input: HourCorrection, request: string) {
    const result = await operations.correct(company, request, entry, version, input);
    await cache.invalidateQueries({ queryKey: ['hours', actor, company] });
    return result;
  }
  function reason(prefix: string) {
    return (
      <Field id={prefix + 'reason'} label="Justificativa interna">
        <TextArea id={prefix + 'reason'} name="reason" required minLength={3} maxLength={1000} />
      </Field>
    );
  }
  return (
    <details className="tw:mt-2">
      <summary className="tw:cursor-pointer">Corrigir lançamento</summary>
      <div className="tw:grid tw:gap-3">
        <ActionForm
          key={version}
          label="Salvar correção de horas"
          submit={(values, request) =>
            submit(
              {
                kind: 'edit',
                date: String(values.get('day') ?? ''),
                minutes: Number(values.get('minutes')),
                description: String(values.get('description') ?? ''),
                visible: values.has('visible'),
                reason: String(values.get('reason') ?? ''),
              },
              request,
            )
          }
        >
          {(prefix) => (
            <>
              <Field id={prefix + 'day'} label="Data do trabalho">
                <Input id={prefix + 'day'} name="day" type="date" defaultValue={day} required />
              </Field>
              <Field id={prefix + 'minutes'} label="Duração em minutos">
                <Input
                  id={prefix + 'minutes'}
                  name="minutes"
                  type="number"
                  defaultValue={minutes}
                  min={1}
                  max={1440}
                  required
                />
              </Field>
              <Field id={prefix + 'description'} label="Descrição da atividade">
                <Input
                  id={prefix + 'description'}
                  name="description"
                  defaultValue={description}
                  maxLength={1000}
                  required
                />
              </Field>
              <Checkbox name="visible" defaultChecked={visible}>
                Visível ao Cliente quando o mês estiver liberado
              </Checkbox>
              {reason(prefix)}
            </>
          )}
        </ActionForm>
        <ActionForm
          label="Excluir lançamento"
          submit={(values, request) =>
            submit({ kind: 'delete', reason: String(values.get('reason') ?? '') }, request)
          }
        >
          {(prefix) => (
            <>
              <Checkbox name="remove" required>
                Confirmo a retirada destas horas do extrato.
              </Checkbox>
              {reason(prefix)}
            </>
          )}
        </ActionForm>
      </div>
    </details>
  );
}

export function HourActions({
  company,
  actor,
  delivery,
  task,
}: {
  company: string;
  actor?: string;
  delivery?: string;
  task?: string;
}) {
  const { hourOperations, projectWorkspace } = useRouteContext({ from: '__root__' });
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const timerKey = ['phase4-timers', actor, company];
  const timers = useQuery({
    queryKey: timerKey,
    queryFn: hourOperations ? ({ signal }) => hourOperations.timers(company, signal) : skipToken,
  });
  const projects = useQuery({
    queryKey: ['projects', actor, company, page],
    queryFn:
      !delivery && hourOperations && projectWorkspace
        ? ({ signal }) => projectWorkspace.list(company, page, signal)
        : skipToken,
  });
  const context = useQuery({
    queryKey: ['phase4-hour-link', actor, company, delivery, task],
    queryFn:
      delivery && hourOperations
        ? ({ signal }) => hourOperations.link(company, delivery, task ?? null, signal)
        : skipToken,
  });
  if (!hourOperations) return null;

  async function submit(input: HourAction, id: string) {
    try {
      return await hourOperations?.submit(company, id, input);
    } finally {
      await Promise.all([
        cache.invalidateQueries({ queryKey: timerKey }),
        cache.invalidateQueries({ queryKey: ['hours', actor, company] }),
        cache.invalidateQueries({ queryKey: ['phase4-hour-link', actor, company] }),
      ]);
    }
  }
  function fields(prefix: string) {
    return (
      <>
        {!delivery && (
          <Field id={prefix + 'project'} label="Projeto">
            <Select id={prefix + 'project'} name="project">
              <option value="">Sem projeto</option>
              {projects.data?.projects
                .filter(
                  (project) =>
                    ['active', 'approved', 'rebriefing', 'closed'].includes(
                      project.planning_status,
                    ) && project.execution_status !== 'cancelled',
                )
                .map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
            </Select>
          </Field>
        )}
        <Field id={prefix + 'description'} label="Descrição da atividade">
          <Input id={prefix + 'description'} name="description" required maxLength={1000} />
        </Field>
        <label className="tw:flex tw:items-center tw:gap-2">
          <CheckboxInput name="visible" /> Visível ao Cliente quando o mês estiver liberado
        </label>
      </>
    );
  }
  function read(values: FormData) {
    return {
      project: context.data?.project ?? (String(values.get('project') ?? '') || null),
      link: context.data ? { delivery: context.data.delivery, task: context.data.task } : undefined,
      description: String(values.get('description') ?? ''),
      visible: values.has('visible'),
    };
  }
  return (
    <section className="tw:grid tw:gap-3" aria-label="Operações de horas">
      {delivery && (
        <div>
          {context.data && (
            <p>
              Vínculo:{' '}
              {[context.data.projectName, context.data.deliveryName, context.data.taskName]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          {context.isPending && <p role="status">Carregando vínculo…</p>}
          {(context.isError || context.data === null) && (
            <FeedbackMessage tone="error">Vínculo indisponível para horas.</FeedbackMessage>
          )}
          {context.data && !context.data.canStart && (
            <p>Retome a execução para iniciar um timer neste vínculo.</p>
          )}
          <Link
            to="/admin/horas"
            search={(previous) =>
              workspaceSearch.parse({ ...previous, delivery: undefined, task: undefined })
            }
          >
            Voltar a lançar horas sem este vínculo
          </Link>
        </div>
      )}
      {projects.isError && (
        <FeedbackMessage tone="error">
          Não foi possível listar os projetos para vínculo.
        </FeedbackMessage>
      )}
      {(projects.data?.total ?? 0) > 25 && (
        <div className="tw:flex tw:gap-2">
          <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Projetos anteriores
          </Button>
          <Button
            variant="secondary"
            disabled={page * 25 >= (projects.data?.total ?? 0)}
            onClick={() => setPage(page + 1)}
          >
            Mais projetos
          </Button>
        </div>
      )}
      {(!delivery || context.data) && (
        <ActionForm
          key={`manual:${delivery ?? ''}:${task ?? ''}`}
          label="Registrar horas manuais"
          submit={(values, id) =>
            submit(
              {
                kind: 'manual',
                ...read(values),
                date: String(values.get('date') ?? ''),
                minutes: Number(values.get('minutes')),
                note: String(values.get('note') ?? ''),
              },
              id,
            )
          }
        >
          {(prefix) => (
            <>
              {fields(prefix)}
              <Field id={prefix + 'date'} label="Data do trabalho">
                <Input id={prefix + 'date'} name="date" type="date" required />
              </Field>
              <Field id={prefix + 'minutes'} label="Duração em minutos">
                <Input
                  id={prefix + 'minutes'}
                  name="minutes"
                  type="number"
                  min={1}
                  max={1440}
                  required
                />
              </Field>
              <Field id={prefix + 'note'} label="Justificativa interna">
                <TextArea id={prefix + 'note'} name="note" required maxLength={1000} />
              </Field>
            </>
          )}
        </ActionForm>
      )}
      {timers.isError && (
        <FeedbackMessage tone="error">Não foi possível carregar os timers.</FeedbackMessage>
      )}
      {timers.isSuccess && timers.data.length === 0 && (!delivery || context.data?.canStart) && (
        <ActionForm
          key={`timer:${delivery ?? ''}:${task ?? ''}`}
          label="Iniciar timer"
          submit={(values, id) => submit({ kind: 'start', ...read(values) }, id)}
        >
          {fields}
        </ActionForm>
      )}
      {timers.data?.map((timer) => (
        <div key={timer.id} className="tw:grid tw:gap-2">
          <p>
            {timer.description ?? 'Atividade'} · {formatServerInstant(timer.startedAt)}
          </p>
          {timer.status === 'paused' ? (
            <>
              {timer.closedSegment && (
                <p>Trecho anterior fechado. A retomada começa outro trecho.</p>
              )}
              <ActionForm
                label="Retomar timer"
                submit={(_, id) => submit({ kind: 'resume', timer: timer.id }, id)}
              />
              {timer.closedSegment && (
                <ActionForm
                  label="Encerrar pausa"
                  submit={(_, id) => submit({ kind: 'stop', timer: timer.id }, id)}
                />
              )}
            </>
          ) : (
            <>
              <ActionForm
                label="Pausar timer"
                submit={(_, id) => submit({ kind: 'pause', timer: timer.id }, id)}
              />
              <ActionForm
                label="Concluir timer"
                submit={(_, id) => submit({ kind: 'stop', timer: timer.id }, id)}
              />
            </>
          )}
        </div>
      ))}
    </section>
  );
}
