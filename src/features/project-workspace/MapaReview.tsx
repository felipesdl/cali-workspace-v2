import { type MapaEntry } from '../../api/modules/project-workspace/admin-read';
import {
  mapaReviewStatus,
  type DomainOperations,
} from '../../api/modules/project-workspace/domain-operations';
import { Field } from '../../components/ds/field/Field';
import { formatServerInstant } from '../../lib/dates';
import { ActionForm } from './ActionForm';

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
  const current = mapaReviewStatus.safeParse(
    entry.status === 'em_revisao' ? 'em_andamento' : entry.status,
  );
  return (
    <article className="tw:grid tw:gap-2 tw:rounded-control tw:border tw:border-border-default tw:p-4">
      <h2>{entry.protocol}</h2>
      <p>
        {formatServerInstant(entry.createdAt)} ·{' '}
        {current.success ? statusLabels[current.data] : entry.status}
      </p>
      {operations && current.success ? (
        <ActionForm
          label="Salvar triagem do Mapa"
          submit={async (fields) => {
            const status = mapaReviewStatus.parse(fields.get('status'));
            const id = await operations.reviewMapa(
              company,
              entry.id,
              entry.revision,
              status,
              String(fields.get('opinion') ?? ''),
            );
            await saved();
            return id;
          }}
        >
          {(prefix) => (
            <>
              <Field id={prefix + 'status'} label="Situação">
                <select id={prefix + 'status'} name="status" defaultValue={current.data}>
                  {mapaReviewStatus.options.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id={prefix + 'opinion'} label="Parecer interno">
                <textarea
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
