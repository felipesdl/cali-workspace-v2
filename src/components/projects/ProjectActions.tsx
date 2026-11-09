import { FeedbackMessage } from '../ds/feedback/FeedbackMessage';
import { Input, Select, TextArea } from '../ds/field/Controls';
import { ActionForm } from '../workspace/ActionForm';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { type ProjectDetail } from '../../api/shared/workspace/schemas';
import { type ProjectAction } from '../../api/shared/workspace/operations';
import { Button } from '../ds/button/Button';
import { useProjectAction } from './useProjectAction';
import { Field } from '../ds/field/Field';

const value = (fields: FormData, key: string) => String(fields.get(key) ?? '');

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
    <details className="tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-3">
      <summary className="tw:cursor-pointer tw:font-semibold tw:text-brand">Novo projeto</summary>
      <div className="tw:mt-3">
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
                <Input id={prefix + 'name'} name="name" required maxLength={180} />
              </Field>
              <Field id={prefix + 'start'} label="Início planejado">
                <Input id={prefix + 'start'} name="start" type="date" required />
              </Field>
              <Field id={prefix + 'description'} label="Objetivo">
                <TextArea id={prefix + 'description'} name="description" maxLength={8000} />
              </Field>
            </>
          )}
        </ActionForm>
      </div>
    </details>
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
            <Select
              id={prefix + 'kind'}
              value={kind}
              onChange={(event) =>
                setKind(event.target.value === 'workstream' ? 'workstream' : 'deliverable')
              }
            >
              <option value="workstream">Frente</option>
              <option value="deliverable">Entregável</option>
            </Select>
          </Field>
          <Field id={prefix + 'name'} label="Nome do item">
            <Input id={prefix + 'name'} name="name" required maxLength={180} />
          </Field>
          {kind === 'deliverable' && (
            <>
              <Field id={prefix + 'front'} label="Frente">
                <Select id={prefix + 'front'} name="workstream">
                  <option value="">Sem frente</option>
                  {choices.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id={prefix + 'due'} label="Prazo em horário de Brasília">
                <Input id={prefix + 'due'} name="due" type="datetime-local" required />
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
        <FeedbackMessage tone="error">Não foi possível carregar as frentes.</FeedbackMessage>
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

type Review = NonNullable<ProjectDetail['review']>;

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
            {review.changes && (
              <p>
                {review.changes.targetLabel} · {review.changes.actionLabel}
                {review.changes.requestedDate && (
                  <> · Data desejada {review.changes.requestedDate}</>
                )}
                {review.changes.swapTargetLabel && (
                  <> · Troca com {review.changes.swapTargetLabel}</>
                )}
              </p>
            )}
            <p>
              Confira e salve as mudanças no planejamento antes de acolher o pedido. A decisão abre
              uma nova revisão para o Cliente.
            </p>
            <Field id={prefix + 'decision'} label="Decisão">
              <Select id={prefix + 'decision'} name="decision" required defaultValue="">
                <option value="" disabled>
                  Selecione
                </option>
                <option value="accept">Acolher ajuste</option>
                <option value="reject">Recusar ajuste</option>
              </Select>
            </Field>
            <ReviewNote prefix={prefix} />
          </>
        )}
      </ActionForm>
    );
  return null;
}

function ReviewNote({ prefix, minimum = 3 }: { prefix: string; minimum?: number }) {
  return (
    <Field id={prefix + 'note'} label="Justificativa">
      <TextArea id={prefix + 'note'} name="note" required minLength={minimum} maxLength={4000} />
    </Field>
  );
}

const deliveryStates = {
  in_progress: 'Em execução',
  internal_review: 'Em revisão interna',
  client_review: 'Enviar para revisão do Cliente',
  standby: 'Em espera',
  rebriefing: 'Revisão de escopo',
  cancelled: 'Cancelar',
} as const;

export function DeliveryActions({
  company,
  actor,
  project,
  delivery,
  expected,
  status,
  admin,
}: {
  company: string;
  actor?: string;
  project: string;
  delivery: string;
  expected: string;
  status: string;
  admin: boolean;
}) {
  const submit = useProjectAction(company, actor, project);
  if (!submit || status === 'cancelled') return null;
  const scope = { kind: 'deliverable', project, delivery, expected } as const;
  if (admin && status === 'approved')
    return (
      <ActionForm
        label="Reabrir para correção"
        submit={(fields) =>
          submit({
            ...scope,
            decision: 'reopen',
            note: value(fields, 'note'),
          })
        }
      >
        {(prefix) => <ReviewNote prefix={prefix} />}
      </ActionForm>
    );
  if (admin)
    return (
      <ActionForm
        label="Atualizar entregável"
        submit={(fields) => {
          const next = value(fields, 'status');
          if (!isDeliveryState(next)) return Promise.reject(new Error('Selecione a situação.'));
          return submit({
            ...scope,
            decision: 'status',
            status: next,
            note: value(fields, 'note'),
          });
        }}
      >
        {(prefix) => (
          <>
            <Field id={prefix + 'status'} label="Próxima situação">
              <Select id={prefix + 'status'} name="status" required defaultValue="">
                <option value="" disabled>
                  Selecione
                </option>
                {Object.entries(deliveryStates)
                  .filter(([key]) => key !== status)
                  .map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field
              id={prefix + 'note'}
              label="Motivo para espera, revisão de escopo ou cancelamento"
            >
              <TextArea id={prefix + 'note'} name="note" maxLength={4000} />
            </Field>
          </>
        )}
      </ActionForm>
    );
  if (status !== 'client_review') return null;
  return (
    <div className="tw:grid tw:gap-3">
      <ActionForm
        label="Aprovar entregável"
        submit={(fields) =>
          submit({
            ...scope,
            decision: 'approve',
            score: Number(fields.get('score')),
            note: value(fields, 'note'),
          })
        }
      >
        {(prefix) => (
          <>
            <Field id={prefix + 'score'} label="Avaliação de 1 a 5">
              <Select id={prefix + 'score'} name="score" required defaultValue="">
                <option value="" disabled>
                  Selecione
                </option>
                {[1, 2, 3, 4, 5].map((score) => (
                  <option key={score} value={score}>
                    {score}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id={prefix + 'note'} label="Comentário obrigatório para notas de 1 a 3">
              <TextArea id={prefix + 'note'} name="note" maxLength={4000} />
            </Field>
          </>
        )}
      </ActionForm>
      <ActionForm
        label="Solicitar ajuste do entregável"
        submit={(fields) =>
          submit({
            ...scope,
            decision: 'adjust',
            note: value(fields, 'note'),
          })
        }
      >
        {(prefix) => <ReviewNote prefix={prefix} />}
      </ActionForm>
    </div>
  );
}

function isDeliveryState(value: string): value is keyof typeof deliveryStates {
  return Object.prototype.hasOwnProperty.call(deliveryStates, value);
}

export function LifecycleActions({
  company,
  actor,
  project,
  execution,
  item,
}: {
  company: string;
  actor?: string;
  project: string;
  execution: string;
  item?: Extract<ProjectAction, { kind: 'lifecycle' }>['item'];
}) {
  const submit = useProjectAction(company, actor, project);
  if (!submit || execution === 'cancelled') return null;
  const actions =
    execution === 'normal'
      ? ([
          { key: 'pause', label: 'Pausar' },
          { key: 'suspend', label: 'Suspender' },
          { key: 'cancel', label: 'Cancelar' },
        ] as const)
      : ([
          { key: 'resume', label: 'Retomar' },
          { key: 'cancel', label: 'Cancelar' },
        ] as const);
  return (
    <ActionForm
      label="Registrar ação de execução"
      submit={(fields) => {
        const decision = actions.find((item) => item.key === fields.get('action'))?.key;
        if (!decision) return Promise.reject(new Error('Selecione a ação.'));
        return submit({
          kind: 'lifecycle',
          project,
          expected: execution,
          item,
          decision,
          note: value(fields, 'note'),
          resume: value(fields, 'resume') || null,
        });
      }}
    >
      {(prefix) => (
        <>
          <Field id={prefix + 'action'} label="Ação">
            <Select id={prefix + 'action'} name="action" required defaultValue="">
              <option value="" disabled>
                Selecione
              </option>
              {actions.map(({ key, label }) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <ReviewNote prefix={prefix} minimum={4} />
          <Field id={prefix + 'resume'} label="Data planejada de retomada">
            <Input id={prefix + 'resume'} name="resume" type="date" />
          </Field>
        </>
      )}
    </ActionForm>
  );
}
