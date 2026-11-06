import { ActionForm } from './ActionForm';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { type ProjectAction } from '../../api/modules/project-workspace/operations';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';

const value = (fields: FormData, key: string) => String(fields.get(key) ?? '');

function useProjectAction(company: string, actor: string | undefined, project?: string) {
  const { projectOperations } = useRouteContext({ from: '__root__' });
  const cache = useQueryClient();
  if (!projectOperations) return null;
  return async (command: ProjectAction) => {
    try {
      return await projectOperations(company, command);
    } finally {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['projects', actor, company] }),
        cache.invalidateQueries({ queryKey: ['project', actor, company, project] }),
      ]);
    }
  };
}

export function CreateProject({
  company,
  actor,
  open,
}: {
  company: string;
  actor?: string;
  open: (project: string) => void;
}) {
  const submit = useProjectAction(company, actor);
  if (!submit) return null;
  return (
    <ActionForm
      label="Criar rascunho"
      saved={open}
      submit={(fields, id) =>
        submit({
          kind: 'create-project',
          id,
          name: value(fields, 'name'),
          description: value(fields, 'description'),
          start: value(fields, 'start'),
        })
      }
    >
      {(prefix) => (
        <>
          <Field id={prefix + 'name'} label="Nome do projeto">
            <input id={prefix + 'name'} name="name" required maxLength={180} />
          </Field>
          <Field id={prefix + 'start'} label="Início planejado">
            <input id={prefix + 'start'} name="start" type="date" required />
          </Field>
          <Field id={prefix + 'description'} label="Objetivo">
            <textarea id={prefix + 'description'} name="description" maxLength={8000} />
          </Field>
        </>
      )}
    </ActionForm>
  );
}

type Choice = { id: string; name: string };

function AddItem({
  project,
  choices,
  submit,
}: {
  project: string;
  choices: readonly Choice[];
  submit: (command: ProjectAction) => Promise<string>;
}) {
  const [kind, setKind] = useState<'workstream' | 'deliverable'>('workstream');
  return (
    <ActionForm
      label={kind === 'workstream' ? 'Adicionar frente' : 'Adicionar entregável'}
      submit={(fields, id) => {
        const name = value(fields, 'name');
        if (kind === 'workstream') return submit({ kind: 'add-workstream', project, id, name });
        return submit({
          kind: 'add-deliverable',
          project,
          id,
          name,
          workstream: value(fields, 'workstream') || null,
          due: value(fields, 'due'),
        });
      }}
    >
      {(prefix) => (
        <>
          <Field id={prefix + 'kind'} label="Tipo de item">
            <select
              id={prefix + 'kind'}
              value={kind}
              onChange={(event) =>
                setKind(event.target.value === 'workstream' ? 'workstream' : 'deliverable')
              }
            >
              <option value="workstream">Frente</option>
              <option value="deliverable">Entregável</option>
            </select>
          </Field>
          <Field id={prefix + 'name'} label="Nome do item">
            <input id={prefix + 'name'} name="name" required maxLength={180} />
          </Field>
          {kind === 'deliverable' && (
            <>
              <Field id={prefix + 'front'} label="Frente">
                <select id={prefix + 'front'} name="workstream">
                  <option value="">Sem frente</option>
                  {choices.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id={prefix + 'due'} label="Prazo em horário de Brasília">
                <input id={prefix + 'due'} name="due" type="datetime-local" required />
              </Field>
            </>
          )}
        </>
      )}
    </ActionForm>
  );
}

function DraftActions({
  company,
  actor,
  project,
  submit,
}: {
  company: string;
  actor?: string;
  project: string;
  submit: (command: ProjectAction) => Promise<string>;
}) {
  const { projectWorkspace } = useRouteContext({ from: '__root__' });
  const [choicePage, setChoicePage] = useState(1);
  const choices = useQuery({
    queryKey: ['project', actor, company, project, 'workstreams', choicePage],
    queryFn: ({ signal }) =>
      projectWorkspace?.detail(company, project, 'workstreams', choicePage, signal),
    enabled: Boolean(projectWorkspace),
  });
  return (
    <div className="tw:grid tw:gap-3">
      {choices.isError ? (
        <p role="alert">Não foi possível carregar as frentes.</p>
      ) : (
        <AddItem project={project} choices={choices.data?.items.rows ?? []} submit={submit} />
      )}
      {(choices.data?.items.total ?? 0) > 25 && (
        <div className="tw:flex tw:gap-2" aria-label="Páginas de frentes para vínculo">
          <Button
            variant="secondary"
            disabled={choicePage === 1}
            onClick={() => setChoicePage(choicePage - 1)}
          >
            Frentes anteriores
          </Button>
          <Button
            variant="secondary"
            disabled={choicePage * 25 >= (choices.data?.items.total ?? 0)}
            onClick={() => setChoicePage(choicePage + 1)}
          >
            Mais frentes
          </Button>
        </div>
      )}
      <ActionForm
        label="Enviar cronograma para revisão"
        submit={() => submit({ kind: 'share', project })}
      />
    </div>
  );
}

type Review = { id?: string; status: string; number: number; note?: string | null };

export function ProjectActions({
  company,
  actor,
  project,
  planning,
  review,
  admin,
}: {
  company: string;
  actor?: string;
  project: string;
  planning: string;
  review: Review | null;
  admin: boolean;
}) {
  const submit = useProjectAction(company, actor, project);
  if (!submit) return null;
  if (admin && planning === 'draft')
    return <DraftActions company={company} actor={actor} project={project} submit={submit} />;
  const reviewId = review?.id;
  if (!reviewId) return null;
  const operate = submit;
  const currentReview = reviewId;
  function respond(decision: Extract<ProjectAction, { kind: 'respond' }>['decision'], note = '') {
    return operate({
      kind: 'respond',
      project,
      review: currentReview,
      decision,
      note,
      targetType: decision === 'request_adjustment' ? 'project' : undefined,
    });
  }
  if (!admin && planning === 'client_review' && review.status === 'pending')
    return (
      <div className="tw:grid tw:gap-3">
        <ActionForm label="Aprovar cronograma" submit={async () => respond('approve')} />
        {review.number <= 2 && (
          <ActionForm
            label="Pedir ajuste do cronograma"
            submit={async (fields) => respond('request_adjustment', value(fields, 'note'))}
          >
            {(prefix) => <ReviewNote prefix={prefix} />}
          </ActionForm>
        )}
      </div>
    );
  if (admin && planning === 'adjustment_requested' && review.status === 'adjustment_requested')
    return (
      <ActionForm
        label="Registrar decisão do ajuste"
        submit={async (fields) =>
          respond(
            fields.get('decision') === 'accept' ? 'accept_adjustment' : 'reject_adjustment',
            value(fields, 'note'),
          )
        }
      >
        {(prefix) => (
          <>
            <p>{review.note}</p>
            <Field id={prefix + 'decision'} label="Decisão">
              <select id={prefix + 'decision'} name="decision" required defaultValue="">
                <option value="" disabled>
                  Selecione
                </option>
                <option value="accept">Acolher ajuste</option>
                <option value="reject">Recusar ajuste</option>
              </select>
            </Field>
            <ReviewNote prefix={prefix} />
          </>
        )}
      </ActionForm>
    );
  return null;
}

function ReviewNote({ prefix }: { prefix: string }) {
  return (
    <Field id={prefix + 'note'} label="Justificativa">
      <textarea id={prefix + 'note'} name="note" required minLength={3} maxLength={4000} />
    </Field>
  );
}
