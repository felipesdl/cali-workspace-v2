import { FeedbackMessage } from '../../../../components/ds/feedback/FeedbackMessage';
import { Select, TextArea } from '../../../../components/ds/field/Controls';
import { useEffect, useRef, useState } from 'react';
import { type MapaEntry } from '../../../../api/admin/workspace/admin-read';
import {
  mapaReviewStatus,
  type DomainOperations,
} from '../../../../api/shared/workspace/domain-operations';
import { Field } from '../../../../components/ds/field/Field';
import { formatServerInstant } from '../../../../lib/dates';
import { ActionForm } from '../../../../components/workspace/ActionForm';

const statusLabels = {
  novo: 'Novo',
  em_andamento: 'Em andamento',
  cancelado: 'Cancelado',
};

export function MapaReview({
  entry,
  company,
  operations,
  saved,
}: {
  entry: MapaEntry;
  company: string;
  operations: DomainOperations | null | undefined;
  saved: () => Promise<void>;
}) {
  const [submittedRevision, setSubmittedRevision] = useState<number>();
  const receipt = useRef<HTMLParagraphElement>(null);
  const showReceipt = submittedRevision !== undefined && submittedRevision !== entry.revision;
  useEffect(() => {
    if (showReceipt && document.activeElement === document.body) receipt.current?.focus();
  }, [showReceipt]);

  const current = mapaReviewStatus.safeParse(
    entry.status === 'em_revisao' ? 'em_andamento' : entry.status,
  );
  return (
    <article className="tw:grid tw:min-w-0 tw:gap-2 tw:rounded-control tw:border tw:border-border-default tw:p-4 tw:wrap-anywhere">
      <h2>{entry.protocol}</h2>
      <p>
        {formatServerInstant(entry.createdAt)} ·{' '}
        {current.success ? statusLabels[current.data] : entry.status}
      </p>
      {showReceipt && (
        <FeedbackMessage ref={receipt} tone="success" tabIndex={-1}>
          Triagem atualizada.
        </FeedbackMessage>
      )}
      {operations && current.success ? (
        <ActionForm
          key={entry.revision}
          label="Salvar triagem do Mapa"
          submit={async (fields) => {
            setSubmittedRevision(undefined);
            const status = mapaReviewStatus.parse(fields.get('status'));
            const id = await operations.reviewMapa(
              company,
              entry.id,
              entry.revision,
              status,
              String(fields.get('opinion') ?? ''),
            );
            await saved();
            setSubmittedRevision(entry.revision);
            return id;
          }}
        >
          {(prefix) => (
            <>
              <Field id={prefix + 'status'} label="Situação">
                <Select id={prefix + 'status'} name="status" defaultValue={current.data}>
                  {mapaReviewStatus.options.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id={prefix + 'opinion'} label="Parecer interno">
                <TextArea
                  id={prefix + 'opinion'}
                  name="opinion"
                  maxLength={4000}
                  defaultValue={entry.opinion ?? ''}
                />
              </Field>
            </>
          )}
        </ActionForm>
      ) : (
        entry.opinion && <p className="tw:whitespace-pre-wrap">{entry.opinion}</p>
      )}
    </article>
  );
}
