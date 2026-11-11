import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { AdminMapaOpinions } from '../../../../api/admin/workspace/mapa-opinions';
import type { MapaEntry } from '../../../../api/admin/workspace/admin-read';
import { Button } from '../../../../components/ds/button/Button';
import { FeedbackMessage } from '../../../../components/ds/feedback/FeedbackMessage';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';
import { Field } from '../../../../components/ds/field/Field';
import { Select } from '../../../../components/ds/field/Controls';

export function MapaPartnerAssignment({
  company,
  entry,
  service,
}: {
  company: string;
  entry: MapaEntry;
  service: AdminMapaOpinions | null | undefined;
}) {
  const cache = useQueryClient();
  const [inviteId, setInviteId] = useState('');
  const partners = useQuery({
    queryKey: ['mapa-partners', company],
    enabled: Boolean(service),
    queryFn: ({ signal }) => service!.partners(company, signal),
  });
  const assignment = useQuery({
    queryKey: ['mapa-partner-assignment', company, entry.id],
    enabled: Boolean(service),
    queryFn: ({ signal }) => service!.assignment(company, entry.id, signal),
  });
  const assign = useMutation({
    mutationFn: () => service!.assign(company, entry.id, entry.revision, inviteId),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['mapa-partner-assignment', company, entry.id] });
    },
  });
  if (!service) return null;
  if (partners.isPending || assignment.isPending)
    return <FeedbackState kind="loading">Carregando atribuição Partner…</FeedbackState>;
  if (partners.isError || assignment.isError)
    return (
      <FeedbackState
        kind="error"
        onRetry={() => {
          void partners.refetch();
          void assignment.refetch();
        }}
      >
        Não foi possível carregar atribuição Partner.
      </FeedbackState>
    );
  return (
    <section
      className="tw:grid tw:gap-2 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-3"
      aria-label="Atribuição de parecer Partner"
    >
      <h3 className="tw:m-0">Parecer do Partner</h3>
      {assignment.data.partnerName && (
        <p>
          Atribuído a {assignment.data.partnerName} · revisão {assignment.data.revision}
        </p>
      )}
      <Field id={`mapa-partner-${entry.id}`} label="Partner sintético">
        <Select
          value={inviteId || assignment.data.inviteId || ''}
          onChange={(event) => setInviteId(event.currentTarget.value)}
        >
          <option value="">Selecione um Partner</option>
          {partners.data.map((partner) => (
            <option key={partner.inviteId} value={partner.inviteId}>
              {partner.name}
            </option>
          ))}
        </Select>
      </Field>
      <Button
        disabled={!inviteId || partners.data.length === 0}
        pending={assign.isPending}
        onClick={() => assign.mutate()}
      >
        {assignment.data.inviteId ? 'Alterar atribuição' : 'Atribuir parecer'}
      </Button>
      {assign.isError && <FeedbackMessage tone="error">{assign.error.message}</FeedbackMessage>}
    </section>
  );
}
