import { useId, useState } from 'react';
import { z } from 'zod';
import { type TeamSearch } from '../../api/modules/team/schemas';
import {
  monthlyFields,
  type MonthlyFields,
  type MonthlyRecord,
} from '../../api/modules/team/monthly';
import { useTeamMonthly } from '../../api/modules/team/useTeamMonthly';
import { writeMonthOptions } from '../../api/modules/team/maintenance';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { formatServerInstant } from '../../lib/dates';

const numericFields = [
  { key: 'planned_hours', label: 'Horas previstas', min: 0 },
  { key: 'absence_medical_hours', label: 'Ausências por atestado (horas)', min: 0 },
  { key: 'absence_leave_hours', label: 'Ausências por licença (horas)', min: 0 },
  { key: 'absence_unjustified_hours', label: 'Faltas não justificadas (horas)', min: 0 },
  { key: 'absence_accident_hours', label: 'Ausências por acidente (horas)', min: 0 },
  { key: 'overtime_hours', label: 'Horas extras', min: 0 },
  { key: 'hour_bank_balance', label: 'Saldo do banco de horas' },
  { key: 'enps_score', label: 'eNPS (-100 a 100)', min: -100, max: 100, step: 1 },
  { key: 'climate_score', label: 'Nota de clima (0 a 10)', min: 0, max: 10, step: 0.1 },
  { key: 'climate_participation', label: 'Participação na pesquisa (%)', min: 0, max: 100 },
] satisfies ReadonlyArray<{
  key: keyof MonthlyFields;
  label: string;
  min?: number;
  max?: number;
  step?: number;
}>;

function MetricsEditor({
  record,
  pending,
  onSave,
  onCancel,
}: {
  record: MonthlyRecord | null;
  pending: boolean;
  onSave: (
    fields: MonthlyFields,
    expectedAt: string | null,
    reason: string,
    requestId: string,
  ) => Promise<void>;
  onCancel: () => void;
}) {
  const id = useId();
  const [original] = useState(record);
  const [requestId] = useState(() => crypto.randomUUID());
  const [departments, setDepartments] = useState(() =>
    Object.entries(record?.approved_headcount ?? {}).map(([name, count]) => ({
      id: crypto.randomUUID(),
      name,
      count: String(count),
    })),
  );
  const [error, setError] = useState('');
  return (
    <form
      aria-label="Dados mensais"
      className="tw:grid tw:gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setError('');
        const form = new FormData(event.currentTarget);
        try {
          const values = Object.fromEntries(
            numericFields.map(({ key }) => {
              const raw = z.string().parse(form.get(key)).trim();
              const value = raw === '' ? null : Number(raw.replace(',', '.'));
              return [key, key === 'enps_score' && value !== null ? Math.round(value) : value];
            }),
          );
          const approved = departments.map((row) => ({
            name: row.name.trim(),
            count: Number(row.count),
          }));
          if (
            approved.some((row) => !row.name || row.count < 0 || !Number.isInteger(row.count)) ||
            new Set(approved.map((row) => row.name)).size !== approved.length
          )
            throw new Error('Informe departamentos distintos e contagens inteiras não negativas.');
          const fields = monthlyFields.parse({
            ...values,
            approved_headcount: Object.fromEntries(approved.map((row) => [row.name, row.count])),
            notes: z.string().parse(form.get('notes')).trim() || null,
          });
          await onSave(
            fields,
            original?.updated_at ?? null,
            z.string().parse(form.get('reason') ?? ''),
            requestId,
          );
        } catch (cause) {
          setError(
            cause instanceof z.ZodError
              ? 'Confira os valores e limites informados.'
              : cause instanceof Error
                ? cause.message
                : 'Não foi possível gravar os dados.',
          );
        }
      }}
    >
      <p className="tw:text-caption tw:text-muted-copy">
        Informe os totais do mês. Campos vazios permanecem sem informação. Use observações sem nomes
        ou dados individuais.
      </p>
      <fieldset
        disabled={pending}
        className="tw:grid tw:min-w-0 tw:grid-cols-2 tw:gap-3 tw:mobile:grid-cols-1"
      >
        {numericFields.map((field) => (
          <Field key={field.key} id={`${id}-${field.key}`} label={field.label}>
            <input
              id={`${id}-${field.key}`}
              name={field.key}
              type="number"
              step={'step' in field ? field.step : 'any'}
              min={'min' in field ? field.min : undefined}
              max={'max' in field ? field.max : undefined}
              defaultValue={record?.[field.key] ?? ''}
            />
          </Field>
        ))}
      </fieldset>
      <fieldset disabled={pending} className="tw:grid tw:min-w-0 tw:gap-3">
        <legend className="tw:font-semibold">Quadro aprovado por departamento</legend>
        {departments.map((row) => (
          <div
            className="tw:grid tw:grid-cols-[minmax(0,1fr)_100px_auto] tw:items-end tw:gap-2 tw:mobile:grid-cols-1"
            key={row.id}
          >
            <Field id={`${id}-${row.id}-name`} label="Departamento">
              <input
                id={`${id}-${row.id}-name`}
                value={row.name}
                required
                maxLength={180}
                onChange={(event) =>
                  setDepartments((rows) =>
                    rows.map((item) =>
                      item.id === row.id ? { ...item, name: event.target.value } : item,
                    ),
                  )
                }
              />
            </Field>
            <Field id={`${id}-${row.id}-count`} label="Pessoas">
              <input
                id={`${id}-${row.id}-count`}
                value={row.count}
                type="number"
                required
                min={0}
                step={1}
                onChange={(event) =>
                  setDepartments((rows) =>
                    rows.map((item) =>
                      item.id === row.id ? { ...item, count: event.target.value } : item,
                    ),
                  )
                }
              />
            </Field>
            <Button
              variant="secondary"
              onClick={() => setDepartments((rows) => rows.filter((item) => item.id !== row.id))}
            >
              Remover departamento
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          onClick={() =>
            setDepartments((rows) => [...rows, { id: crypto.randomUUID(), name: '', count: '' }])
          }
        >
          Adicionar departamento
        </Button>
      </fieldset>
      <Field id={`${id}-notes`} label="Observações do mês">
        <textarea
          id={`${id}-notes`}
          name="notes"
          maxLength={5000}
          defaultValue={record?.notes ?? ''}
          disabled={pending}
        />
      </Field>
      {record && (
        <Field id={`${id}-reason`} label="Motivo da correção">
          <textarea
            id={`${id}-reason`}
            name="reason"
            required
            minLength={3}
            maxLength={500}
            disabled={pending}
          />
        </Field>
      )}
      {!record && (
        <p className="tw:text-caption">Depois de enviar, correções são realizadas pela CALI.</p>
      )}
      {error && <FeedbackState kind="error">{error}</FeedbackState>}
      <div className="tw:flex tw:flex-wrap tw:gap-3">
        <Button type="submit" pending={pending}>
          {record ? 'Salvar correção' : 'Enviar dados mensais'}
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function MetricsRead({ record }: { record: MonthlyRecord }) {
  return (
    <div className="tw:grid tw:gap-4">
      <dl className="tw:m-0 tw:grid tw:grid-cols-2 tw:gap-4 tw:mobile:grid-cols-1">
        {numericFields.map((field) => (
          <div key={field.key}>
            <dt className="tw:text-caption tw:text-muted-copy">{field.label}</dt>
            <dd className="tw:m-0 tw:font-semibold">
              {record[field.key] === null ? 'Não informado' : String(record[field.key])}
            </dd>
          </div>
        ))}
      </dl>
      <div>
        <h3 className="tw:text-body">Quadro aprovado por departamento</h3>
        {Object.keys(record.approved_headcount).length === 0 ? (
          <p>Não informado.</p>
        ) : (
          <ul>
            {Object.entries(record.approved_headcount).map(([name, count]) => (
              <li key={name}>
                {name}: {count}
              </li>
            ))}
          </ul>
        )}
      </div>
      {record.notes && <p className="tw:whitespace-pre-wrap">{record.notes}</p>}
      <p className="tw:text-caption tw:text-muted-copy">
        Último registro em {formatServerInstant(record.updated_at)}.
      </p>
    </div>
  );
}

export function TeamMonthly({
  search,
  navigate,
}: {
  search: TeamSearch;
  navigate: (update: Partial<TeamSearch>) => void;
}) {
  const month = useTeamMonthly(search);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  if (month.state.isPending)
    return <FeedbackState kind="loading">Carregando dados do mês…</FeedbackState>;
  if (month.state.isError)
    return (
      <FeedbackState kind="error" onRetry={() => void month.state.refetch()}>
        Não foi possível carregar os dados do mês.
      </FeedbackState>
    );
  const data = month.state.data;
  if (!data) return null;
  const writable = writeMonthOptions().includes(month.month.slice(0, 7));
  const canWrite = writable && (month.admin ? Boolean(data.metrics) : !data.metrics);
  return (
    <section
      aria-label="Dados do mês"
      className="tw:grid tw:min-w-0 tw:gap-5 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4"
    >
      <h2 className="tw:m-0 tw:text-section tw:font-bold tw:text-brand">Dados do mês</h2>
      <Field id="team-metrics-month" label="Mês de referência">
        <input
          type="month"
          id="team-metrics-month"
          value={month.month.slice(0, 7)}
          onChange={(event) => navigate({ month: event.currentTarget.value || undefined, page: 1 })}
        />
      </Field>
      {message && <p role="status">{message}</p>}
      {editing ? (
        <MetricsEditor
          record={data.metrics}
          pending={month.write.isPending}
          onCancel={() => setEditing(false)}
          onSave={async (fields, expectedAt, reason, requestId) => {
            await month.write.mutateAsync({ fields, expectedAt, reason, requestId });
            setEditing(false);
            setMessage('Dados mensais gravados.');
          }}
        />
      ) : (
        <>
          {data.metrics ? (
            <MetricsRead record={data.metrics} />
          ) : (
            <FeedbackState kind="empty">
              Os dados deste mês ainda não foram informados pelo Cliente.
            </FeedbackState>
          )}
          {canWrite && (
            <Button
              onClick={() => {
                setMessage('');
                setEditing(true);
              }}
            >
              {data.metrics ? 'Corrigir dados mensais' : 'Informar dados mensais'}
            </Button>
          )}
          {!month.admin && data.metrics && (
            <p className="tw:text-caption tw:text-muted-copy">
              Para corrigir os dados gravados, entre em contato com a CALI.
            </p>
          )}
        </>
      )}
      <section aria-label="Histórico dos dados mensais">
        <h3 className="tw:text-body tw:font-bold">Histórico dos dados mensais</h3>
        {data.events
          .filter((event) => event.domain === 'metrics')
          .map((event) => (
            <p key={event.id} className="tw:text-caption">
              Revisão {event.revision} · {formatServerInstant(event.recorded_at)}
              {event.reason ? ` · ${event.reason}` : ''}
            </p>
          ))}
        {!data.events.some((event) => event.domain === 'metrics') && (
          <p className="tw:text-caption tw:text-muted-copy">Nenhum lançamento registrado.</p>
        )}
      </section>
    </section>
  );
}
