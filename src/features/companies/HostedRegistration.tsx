import { useId, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useHostedRegistration } from '../../api/modules/companies/hooks/useHostedRegistration';
import {
  hostedRegistrationDraft,
  type HostedRegistration as RegistrationRecord,
} from '../../api/modules/companies/hosted-registration';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';

const fields = {
  segment: 'Segmento da empresa',
  monthly_hours_contracted: 'Horas mensais contratadas',
  address_street: 'Endereço e complemento',
  address_number: 'Número',
  address_neighborhood: 'Bairro',
  address_city: 'Cidade',
  address_state: 'Estado (sigla)',
  has_branches: 'Possui filiais',
  branches: 'Localidades das filiais, uma por linha',
} as const;

const fieldNames = hostedRegistrationDraft.keyof().options;

function displayValue(record: RegistrationRecord, name: (typeof fieldNames)[number]) {
  if (name === 'has_branches') return record.has_branches ? 'Sim' : 'Não';
  if (name === 'branches') return record.has_branches ? (record.branches ?? []).join('\n') : '';
  return String(record[name] ?? '');
}

function RegistrationEditor({
  record,
  onClose,
  onSave,
}: {
  record: RegistrationRecord;
  onClose: () => void;
  onSave: (values: ReturnType<typeof hostedRegistrationDraft.parse>) => Promise<void>;
}) {
  const prefix = useId();
  const [error, setError] = useState('');
  const [original] = useState(() => record);
  const form = useForm({
    defaultValues: {
      segment: displayValue(original, 'segment'),
      monthly_hours_contracted: displayValue(original, 'monthly_hours_contracted'),
      address_street: displayValue(original, 'address_street'),
      address_number: displayValue(original, 'address_number'),
      address_neighborhood: displayValue(original, 'address_neighborhood'),
      address_city: displayValue(original, 'address_city'),
      address_state: displayValue(original, 'address_state'),
      has_branches: original.has_branches ? ('yes' as const) : ('no' as const),
      branches: displayValue(original, 'branches'),
    },
    validators: { onSubmit: hostedRegistrationDraft },
    onSubmit: async ({ value }) => {
      try {
        setError('');
        await onSave(hostedRegistrationDraft.parse(value));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o cadastro.');
      }
    },
  });
  return (
    <form
      aria-label="Editar cadastro complementar"
      className="tw:grid tw:gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="tw:grid tw:grid-cols-2 tw:gap-4 tw:mobile:grid-cols-1">
        {fieldNames.map((name) => (
          <form.Field name={name} key={name}>
            {(field) => {
              const id = `${prefix}-${name}`;
              const message = field.state.meta.errors[0]?.message;
              const props = {
                id,
                name,
                value: field.state.value,
                'aria-invalid': Boolean(message),
                'aria-describedby': message ? `${id}-error` : undefined,
                disabled: form.state.isSubmitting,
              };
              return (
                <Field id={id} label={fields[name]} error={message}>
                  {name === 'has_branches' ? (
                    <select {...props} onChange={(event) => field.handleChange(event.target.value)}>
                      <option value="no">Não</option>
                      <option value="yes">Sim</option>
                    </select>
                  ) : name === 'branches' ? (
                    <textarea
                      {...props}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  ) : (
                    <input
                      {...props}
                      inputMode={name === 'monthly_hours_contracted' ? 'decimal' : undefined}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  )}
                </Field>
              );
            }}
          </form.Field>
        ))}
      </div>
      {error && <FeedbackState kind="error">{error}</FeedbackState>}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <div className="tw:flex tw:flex-wrap tw:gap-2">
            <Button type="submit" pending={pending}>
              Salvar cadastro complementar
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Cancelar edição
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}

export function HostedRegistration({ companyId }: { companyId: string }) {
  const { available, canEdit, query, update } = useHostedRegistration(companyId);
  const [editing, setEditing] = useState<RegistrationRecord | null>(null);
  const [saved, setSaved] = useState(false);
  const heading = useId();
  if (!available) return null;
  return (
    <section
      aria-labelledby={heading}
      aria-busy={query.isFetching}
      className="tw:grid tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4"
    >
      <h2 id={heading} className="tw:m-0 tw:text-section tw:font-bold tw:text-brand">
        Cadastro complementar
      </h2>
      {query.isPending && <FeedbackState kind="loading">Carregando cadastro…</FeedbackState>}
      {query.isError && (
        <FeedbackState kind="error" onRetry={() => void query.refetch()}>
          Não foi possível carregar o cadastro.
        </FeedbackState>
      )}
      {editing && (
        <RegistrationEditor
          record={editing}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            await update.mutateAsync({ record: editing, values });
            setEditing(null);
            setSaved(true);
          }}
        />
      )}
      {query.data && !editing && (
        <>
          <dl className="tw:m-0 tw:grid tw:grid-cols-2 tw:gap-3 tw:mobile:grid-cols-1 tw:[&_dd]:m-0 tw:[&_dd]:wrap-anywhere tw:[&_dd]:whitespace-pre-wrap tw:[&_dt]:text-caption tw:[&_dt]:text-muted-copy">
            {!canEdit && (
              <div>
                <dt>Serviço contratado</dt>
                <dd>{query.data.service_type ?? query.data.service_plan ?? 'Não informado'}</dd>
              </div>
            )}
            {fieldNames.map((name) => (
              <div key={name}>
                <dt>{name === 'branches' ? 'Filiais' : fields[name]}</dt>
                <dd>{displayValue(query.data, name) || 'Não informado'}</dd>
              </div>
            ))}
          </dl>
          {canEdit && (
            <Button
              variant="secondary"
              className="tw:justify-self-start"
              onClick={() => {
                if (!query.data) return;
                setSaved(false);
                setEditing(query.data);
              }}
            >
              Editar cadastro complementar
            </Button>
          )}
        </>
      )}
      {saved && <p role="status">Cadastro complementar salvo.</p>}
    </section>
  );
}
