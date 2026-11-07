import { toBrasiliaDateTimeInput } from '../../lib/dates';
import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { z } from 'zod';
import { type ProjectDetail } from '../../api/modules/project-workspace/schemas';
import { ActionForm } from './ActionForm';
import { useProjectAction } from './useProjectAction';
import { Field } from '../../components/ds/field/Field';
import { Button } from '../../components/ds/button/Button';

const text = (fields: FormData, key: string) => String(fields.get(key) ?? '');
const complexity = z.enum(['MC1', 'MC2', 'MC3']).nullable();
type Scope = { company: string; actor?: string; project: string };
type Item = ProjectDetail['items']['rows'][number];

function ItemSelect({
  scope,
  section,
  name,
  label,
  selected,
  exclude,
  equivalent,
}: {
  scope: Scope;
  section: 'workstreams' | 'deliverables';
  name: string;
  label: string;
  selected?: string | null;
  exclude?: string;
  equivalent?: string | null;
}) {
  const { projectWorkspace } = useRouteContext({ from: '__root__' });
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState(selected ?? '');
  const id = useId();
  const choices = useQuery({
    queryKey: ['project', scope.actor, scope.company, scope.project, section, page],
    queryFn: ({ signal }) =>
      projectWorkspace?.detail(scope.company, scope.project, section, page, signal),
    enabled: Boolean(projectWorkspace),
  });
  const rows = (choices.data?.items.rows ?? []).filter(
    (item) =>
      item.id !== exclude &&
      item.status !== 'cancelled' &&
      (equivalent === undefined || item.complexity === equivalent),
  );
  return (
    <>
      <Field id={id} label={label}>
        <select
          id={id}
          name={name}
          value={selection}
          onChange={(event) => setSelection(event.target.value)}
          required={section === 'deliverables'}
        >
          <option value="">Selecione</option>
          {selection && !rows.some((item) => item.id === selection) && (
            <option value={selection}>Frente atual</option>
          )}
          {rows.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      {choices.isError && (
        <p role="alert">Não foi possível carregar as opções. O vínculo atual foi mantido.</p>
      )}
      {(choices.data?.items.total ?? 0) > 25 && (
        <div className="tw:flex tw:gap-2" aria-label={'Páginas de ' + label}>
          <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Anteriores
          </Button>
          <Button
            variant="secondary"
            disabled={page * 25 >= (choices.data?.items.total ?? 0)}
            onClick={() => setPage(page + 1)}
          >
            Mais opções
          </Button>
        </div>
      )}
    </>
  );
}

export function EditProject({ scope, plan }: { scope: Scope; plan: ProjectDetail['project'] }) {
  const submit = useProjectAction(scope.company, scope.actor, scope.project);
  if (!submit || !plan.updated_at) return null;
  const expected = plan.updated_at;
  return (
    <details>
      <summary>Editar dados do projeto</summary>
      <ActionForm
        key={expected}
        label="Salvar planejamento"
        submit={(fields) =>
          submit({
            kind: 'edit-plan',
            project: scope.project,
            item: scope.project,
            itemKind: 'project',
            expected,
            decision: 'save',
            name: text(fields, 'name'),
            description: text(fields, 'description'),
            start: text(fields, 'start'),
            due: null,
            workstream: null,
            complexity: null,
            position: null,
          })
        }
      >
        {(prefix) => (
          <>
            <Field id={prefix + 'name'} label="Nome do projeto">
              <input
                id={prefix + 'name'}
                name="name"
                required
                minLength={2}
                maxLength={180}
                defaultValue={plan.name}
              />
            </Field>
            <Field id={prefix + 'description'} label="Objetivo">
              <textarea
                id={prefix + 'description'}
                name="description"
                maxLength={8000}
                defaultValue={plan.description ?? ''}
              />
            </Field>
            <Field id={prefix + 'start'} label="Início planejado">
              <input
                id={prefix + 'start'}
                name="start"
                type="date"
                required
                defaultValue={plan.roadmap_start_date ?? ''}
              />
            </Field>
          </>
        )}
      </ActionForm>
    </details>
  );
}

export function EditPlanItem({
  scope,
  item,
  section,
  draft,
}: {
  scope: Scope;
  item: Item;
  section: 'workstreams' | 'deliverables';
  draft: boolean;
}) {
  const submit = useProjectAction(scope.company, scope.actor, scope.project);
  if (!submit || !item.updated_at || item.status === 'cancelled') return null;
  const kind = section === 'workstreams' ? 'workstream' : 'deliverable';
  const expected = item.updated_at;
  const base = {
    kind: 'edit-plan',
    itemKind: kind,
    project: scope.project,
    item: item.id,
    expected,
    start: null,
  } as const;
  return (
    <details>
      <summary>Editar {item.name}</summary>
      <ActionForm
        key={expected}
        label="Salvar item do planejamento"
        submit={(fields) =>
          submit({
            ...base,
            decision: 'save',
            name: text(fields, 'name'),
            description: text(fields, 'description'),
            position: Number(fields.get('position')),
            workstream: text(fields, 'front') || null,
            due: kind === 'deliverable' ? text(fields, 'due') : null,
            complexity: complexity.parse(text(fields, 'complexity') || null),
          })
        }
      >
        {(prefix) => (
          <>
            <Field id={prefix + 'name'} label="Nome do item">
              <input
                id={prefix + 'name'}
                name="name"
                required
                minLength={2}
                maxLength={180}
                defaultValue={item.name}
              />
            </Field>
            <Field id={prefix + 'description'} label="Descrição ou objetivo">
              <textarea
                id={prefix + 'description'}
                name="description"
                maxLength={8000}
                defaultValue={item.description ?? ''}
              />
            </Field>
            <Field id={prefix + 'position'} label="Ordem no cronograma">
              <input
                id={prefix + 'position'}
                name="position"
                type="number"
                min={1}
                max={100000}
                required
                defaultValue={item.sort_order ?? 1}
              />
            </Field>
            {kind === 'deliverable' && (
              <>
                <Field id={prefix + 'due'} label="Prazo em horário de Brasília">
                  <input
                    id={prefix + 'due'}
                    name="due"
                    type="datetime-local"
                    required
                    defaultValue={toBrasiliaDateTimeInput(item.due_at)}
                  />
                </Field>
                <Field id={prefix + 'complexity'} label="Complexidade">
                  <select
                    id={prefix + 'complexity'}
                    name="complexity"
                    defaultValue={item.complexity ?? ''}
                  >
                    <option value="">Não definida</option>
                    {complexity.unwrap().options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>
                <ItemSelect
                  scope={scope}
                  section="workstreams"
                  name="front"
                  label="Frente do entregável"
                  selected={item.workstream_id}
                />
              </>
            )}
          </>
        )}
      </ActionForm>
      {draft && (
        <ActionForm
          label="Retirar item do rascunho"
          submit={(fields) =>
            submit({
              ...base,
              decision: 'remove',
              name: '',
              description: '',
              position: null,
              due: null,
              workstream: text(fields, 'destination') || null,
              complexity: null,
            })
          }
        >
          {(prefix) => (
            <>
              <p>
                A retirada preserva a trilha de alterações. Uma frente com entregáveis exige outra
                frente de destino.
              </p>
              {kind === 'workstream' && (
                <ItemSelect
                  scope={scope}
                  section="workstreams"
                  name="destination"
                  label="Transferir entregáveis para"
                  exclude={item.id}
                />
              )}
              <Field id={prefix + 'confirm'} label="Confirme a retirada deste item">
                <input id={prefix + 'confirm'} type="checkbox" required />
              </Field>
            </>
          )}
        </ActionForm>
      )}
    </details>
  );
}

export function ScheduleItemRequest({
  scope,
  item,
  section,
  review,
}: {
  scope: Scope;
  item: Item;
  section: 'workstreams' | 'deliverables';
  review: string;
}) {
  const submit = useProjectAction(scope.company, scope.actor, scope.project);
  const [decision, setDecision] = useState<'reschedule' | 'swap_order' | 'change_proposal'>(
    'reschedule',
  );
  if (!submit || item.status === 'cancelled') return null;
  return (
    <details>
      <summary>Pedir ajuste em {item.name}</summary>
      <ActionForm
        label="Enviar pedido de ajuste do item"
        submit={(fields) =>
          submit({
            kind: 'respond',
            project: scope.project,
            review,
            decision: 'request_adjustment',
            note: text(fields, 'note'),
            targetType: section === 'workstreams' ? 'workstream' : 'deliverable',
            target: item.id,
            itemAction: section === 'deliverables' ? decision : undefined,
            requestedDate:
              section === 'deliverables' && decision === 'reschedule'
                ? text(fields, 'date')
                : undefined,
            swap:
              section === 'deliverables' && decision === 'swap_order'
                ? text(fields, 'swap')
                : undefined,
          })
        }
      >
        {(prefix) => (
          <>
            {section === 'deliverables' && (
              <>
                <Field id={prefix + 'action'} label="Ajuste solicitado">
                  <select
                    id={prefix + 'action'}
                    value={decision}
                    onChange={(event) =>
                      setDecision(
                        z
                          .enum(['reschedule', 'swap_order', 'change_proposal'])
                          .parse(event.target.value),
                      )
                    }
                  >
                    <option value="reschedule">Outra data</option>
                    <option value="swap_order">Trocar ordem com item equivalente</option>
                    <option value="change_proposal">Proposta diferente</option>
                  </select>
                </Field>
                {decision === 'reschedule' && (
                  <Field id={prefix + 'date'} label="Data desejada">
                    <input id={prefix + 'date'} name="date" type="date" required />
                  </Field>
                )}
                {decision === 'swap_order' && (
                  <ItemSelect
                    scope={scope}
                    section="deliverables"
                    name="swap"
                    label="Entregável de mesma complexidade"
                    exclude={item.id}
                    equivalent={item.complexity ?? null}
                  />
                )}
              </>
            )}
            <Field id={prefix + 'note'} label="Descreva o ajuste">
              <textarea id={prefix + 'note'} name="note" required minLength={3} maxLength={4000} />
            </Field>
          </>
        )}
      </ActionForm>
    </details>
  );
}
