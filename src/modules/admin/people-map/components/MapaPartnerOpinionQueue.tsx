import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { AdminMapaOpinions } from '../../../../api/admin/workspace/mapa-opinions';
import { Button } from '../../../../components/ds/button/Button';
import { FeedbackMessage } from '../../../../components/ds/feedback/FeedbackMessage';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';
import { Field } from '../../../../components/ds/field/Field';
import { Select, TextArea } from '../../../../components/ds/field/Controls';

export function MapaPartnerOpinionQueue({
  company,
  service,
}: {
  company: string;
  service: AdminMapaOpinions | null | undefined;
}) {
  const cache = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, 'novo' | 'em_andamento' | 'cancelado'>>(
    {},
  );
  const query = useQuery({
    queryKey: ['mapa-partner-opinion-queue', company],
    enabled: Boolean(service),
    queryFn: ({ signal }) => service!.drafts(company, 1, signal),
  });
  const mutation = useMutation({
    mutationFn: (input: {
      record: string;
      assignmentRevision: number;
      scopeRevision: number;
      decision: 'apply' | 'return';
    }) =>
      service!.decide({
        company,
        ...input,
        status: statuses[input.record] ?? 'em_andamento',
        note: notes[input.record] ?? '',
      }),
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['mapa-partner-opinion-queue', company] }),
        cache.invalidateQueries({ queryKey: ['phase4-mapa'] }),
      ]);
    },
  });
  if (!service) return null;
  if (query.isPending)
    return <FeedbackState kind="loading">Carregando pareceres Partner…</FeedbackState>;
  if (query.isError)
    return (
      <FeedbackState kind="error" onRetry={() => void query.refetch()}>
        Não foi possível carregar pareceres enviados.
      </FeedbackState>
    );
  if (query.data.entries.length === 0) return null;
  return (
    <section
      className="tw:grid tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4"
      aria-label="Revisão de pareceres Partner"
    >
      <h2 className="tw:m-0">Pareceres Partner aguardando revisão</h2>
      {query.data.entries.map((draft) => (
        <article
          key={draft.id}
          className="tw:grid tw:gap-3 tw:border-b tw:border-border-default tw:pb-4"
        >
          <div>
            <h3 className="tw:m-0">{draft.protocol}</h3>
            <p>
              Partner: {draft.partnerName} · enviado{' '}
              {new Date(draft.submittedAt).toLocaleString('pt-BR')}
            </p>
          </div>
          <p className="tw:whitespace-pre-wrap">{draft.opinion}</p>
          <Field id={`mapa-draft-status-${draft.id}`} label="Situação ao aplicar">
            <Select
              value={
                statuses[draft.recordId] ??
                (draft.recordStatus === 'novo' || draft.recordStatus === 'cancelado'
                  ? draft.recordStatus
                  : 'em_andamento')
              }
              onChange={(event) =>
                setStatuses((current) => ({
                  ...current,
                  [draft.recordId]: event.currentTarget.value as
                    'novo' | 'em_andamento' | 'cancelado',
                }))
              }
            >
              <option value="novo">Novo</option>
              <option value="em_andamento">Em andamento</option>
              <option value="cancelado">Cancelado</option>
            </Select>
          </Field>
          <Field id={`mapa-draft-note-${draft.id}`} label="Orientação para devolver">
            <TextArea
              value={notes[draft.recordId] ?? ''}
              maxLength={1000}
              onChange={(event) =>
                setNotes((current) => ({ ...current, [draft.recordId]: event.currentTarget.value }))
              }
            />
          </Field>
          <div className="tw:flex tw:flex-wrap tw:gap-2">
            <Button
              pending={mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  record: draft.recordId,
                  assignmentRevision: draft.assignmentRevision,
                  scopeRevision: draft.scopeRevision,
                  decision: 'apply',
                })
              }
            >
              Aplicar parecer
            </Button>
            <Button
              variant="secondary"
              disabled={(notes[draft.recordId] ?? '').trim().length < 3}
              pending={mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  record: draft.recordId,
                  assignmentRevision: draft.assignmentRevision,
                  scopeRevision: draft.scopeRevision,
                  decision: 'return',
                })
              }
            >
              Devolver para ajuste
            </Button>
          </div>
          {mutation.isError && (
            <FeedbackMessage tone="error">{mutation.error.message}</FeedbackMessage>
          )}
        </article>
      ))}
    </section>
  );
}
