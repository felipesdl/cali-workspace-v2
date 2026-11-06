import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { type HourAction } from '../../api/modules/project-workspace/operations';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';
import { formatServerInstant } from '../../lib/dates';
import { useState } from 'react';
import { ActionForm } from './ActionForm';

export function HourActions({ company, actor }: { company: string; actor?: string }) {
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
      hourOperations && projectWorkspace
        ? ({ signal }) => projectWorkspace.list(company, page, signal)
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
      ]);
    }
  }
  function fields(prefix: string) {
    return (
      <>
        <Field id={prefix + 'project'} label="Projeto">
          <select id={prefix + 'project'} name="project">
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
          </select>
        </Field>
        <Field id={prefix + 'description'} label="Descrição da atividade">
          <input id={prefix + 'description'} name="description" required maxLength={1000} />
        </Field>
        <label className="tw:flex tw:items-center tw:gap-2">
          <input name="visible" type="checkbox" /> Visível ao Cliente quando o mês estiver liberado
        </label>
      </>
    );
  }
  function read(values: FormData) {
    return {
      project: String(values.get('project') ?? '') || null,
      description: String(values.get('description') ?? ''),
      visible: values.has('visible'),
    };
  }
  return (
    <section className="tw:grid tw:gap-3" aria-label="Operações de horas">
      {projects.isError && <p role="alert">Não foi possível listar os projetos para vínculo.</p>}
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
      <ActionForm
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
              <input id={prefix + 'date'} name="date" type="date" required />
            </Field>
            <Field id={prefix + 'minutes'} label="Duração em minutos">
              <input
                id={prefix + 'minutes'}
                name="minutes"
                type="number"
                min={1}
                max={1440}
                required
              />
            </Field>
            <Field id={prefix + 'note'} label="Justificativa interna">
              <textarea id={prefix + 'note'} name="note" required maxLength={1000} />
            </Field>
          </>
        )}
      </ActionForm>
      {timers.isError && <p role="alert">Não foi possível carregar os timers.</p>}
      {timers.isSuccess && timers.data.length === 0 && (
        <ActionForm
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
            <ActionForm
              label="Retomar timer"
              submit={(_, id) => submit({ kind: 'resume', timer: timer.id }, id)}
            />
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
