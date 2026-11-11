import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { FeedbackMessage } from '../../../../components/ds/feedback/FeedbackMessage';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';
import { TextArea } from '../../../../components/ds/field/Controls';
import { Field } from '../../../../components/ds/field/Field';
import { Button } from '../../../../components/ds/button/Button';
import type { PartnerMapaOpinions } from '../../../../api/partner/mapa-opinions';

const diagnosticDimensions = [
  'Maturidade estrutural',
  'Liderança e cultura',
  'Dados e decisão',
  'Dimensões operacionais',
] as const;
const observationLabels = diagnosticDimensions;

function OpinionCard({
  service,
  row,
  refresh,
}: {
  service: PartnerMapaOpinions;
  row: {
    record_id: string;
    assignment_revision: number;
    protocol: string;
    createdAt: string;
    draft_status: 'draft' | 'submitted' | 'approved' | 'returned' | 'superseded' | null;
    opinion: string | null;
    decision_note: string | null;
    diagnostic: {
      version: 1 | 2;
      dimensions: number[];
      score: number;
      observations: (string | null)[];
      recommendedService: string;
    };
  };
  refresh: () => Promise<void>;
}) {
  const mutation = useMutation({
    mutationFn: (action: 'save' | 'submit') =>
      service.save({
        recordId: row.record_id,
        assignmentRevision: row.assignment_revision,
        requestId: crypto.randomUUID(),
        action,
        opinion: String(
          new FormData(
            document.getElementById(`partner-mapa-${row.record_id}`) as HTMLFormElement,
          ).get('opinion') ?? '',
        ),
      }),
    onSuccess: refresh,
  });
  const locked = ['submitted', 'approved', 'superseded'].includes(row.draft_status ?? '');
  return (
    <article className="tw:grid tw:gap-3 tw:border-b tw:border-border-default tw:py-4">
      <div>
        <h3 className="tw:m-0">{row.protocol}</h3>
        <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
          Diagnóstico {row.diagnostic.version} · pontuação {row.diagnostic.score}/10 · recomendação{' '}
          {row.diagnostic.recommendedService}
        </p>
      </div>
      <dl className="tw:grid tw:grid-cols-2 tw:gap-2">
        {row.diagnostic.dimensions.map((value, index) => (
          <div key={diagnosticDimensions[index]}>
            <dt>{diagnosticDimensions[index]}</dt>
            <dd>{value}/10</dd>
          </div>
        ))}
      </dl>
      {row.diagnostic.observations.some(Boolean) && (
        <section aria-label="Observações do diagnóstico">
          <h4>Observações do diagnóstico</h4>
          {row.diagnostic.observations.map(
            (value, index) => value && <p key={observationLabels[index]}>{value}</p>,
          )}
        </section>
      )}
      {row.decision_note && <p>Orientação da CALI: {row.decision_note}</p>}
      <form id={`partner-mapa-${row.record_id}`} className="tw:grid tw:gap-3">
        <Field id={`opinion-${row.record_id}`} label="Seu parecer">
          <TextArea
            name="opinion"
            maxLength={4000}
            defaultValue={row.opinion ?? ''}
            disabled={locked}
          />
        </Field>
        {!locked && (
          <div className="tw:flex tw:flex-wrap tw:gap-2">
            <Button
              type="button"
              variant="secondary"
              pending={mutation.isPending}
              onClick={() => mutation.mutate('save')}
            >
              Salvar rascunho
            </Button>
            <Button
              type="button"
              pending={mutation.isPending}
              onClick={() => mutation.mutate('submit')}
            >
              Enviar para revisão da CALI
            </Button>
          </div>
        )}
      </form>
      {row.draft_status && (
        <p>
          Status:{' '}
          {row.draft_status === 'submitted'
            ? 'Aguardando revisão da CALI'
            : row.draft_status === 'returned'
              ? 'Devolvido para ajuste'
              : row.draft_status === 'approved'
                ? 'Aplicado pela CALI'
                : row.draft_status === 'superseded'
                  ? 'Atribuição encerrada'
                  : 'Rascunho privado'}
        </p>
      )}
      {mutation.isError && <FeedbackMessage tone="error">{mutation.error.message}</FeedbackMessage>}
    </article>
  );
}

export function PartnerMapaOpinionDrafts() {
  const { partnerMapaOpinions } = useRouteContext({ from: '__root__' });
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ['partner-mapa-opinions'],
    enabled: Boolean(partnerMapaOpinions),
    queryFn: ({ signal }) => partnerMapaOpinions!.list(1, signal),
  });
  if (!partnerMapaOpinions) return null;
  if (query.isPending)
    return <FeedbackState kind="loading">Carregando pareceres Mapa atribuídos…</FeedbackState>;
  if (query.isError)
    return (
      <FeedbackState kind="error" onRetry={() => void query.refetch()}>
        Não foi possível consultar pareceres Mapa.
      </FeedbackState>
    );
  if (!query.data.entries.length) return null;
  const refresh = async () => {
    await cache.invalidateQueries({ queryKey: ['partner-mapa-opinions'] });
  };
  return (
    <section
      aria-label="Pareceres Mapa atribuídos"
      className="tw:grid tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4"
    >
      <h2 className="tw:m-0">Pareceres Mapa atribuídos</h2>
      {query.data.entries.map((row) => (
        <OpinionCard
          key={row.record_id}
          service={partnerMapaOpinions}
          row={row}
          refresh={refresh}
        />
      ))}
    </section>
  );
}
