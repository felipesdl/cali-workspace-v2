import { FeedbackMessage } from '../../../../components/ds/feedback/FeedbackMessage';
import { Input, Select } from '../../../../components/ds/field/Controls';
import { useId, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import {
  hostedBrandDraft,
  type HostedBrand as BrandRecord,
  type HostedBrandDraft,
  type LogoChange,
} from '../../../../api/admin/companies/hosted-brand';
import { useHostedBrand } from '../../../../api/admin/companies/hooks/useHostedBrand';
import { companyService } from '../../../../api/admin/companies/registration-schemas';
import { Button } from '../../../../components/ds/button/Button';
import { Field } from '../../../../components/ds/field/Field';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';
import { LogoPicker } from './LogoPicker';
import { useLogoSelection } from '../hooks/useLogoSelection';

const contactFields = {
  name: { label: 'Nome do contato comercial', type: 'text' },
  title: { label: 'Cargo', type: 'text' },
  email: { label: 'E-mail comercial', type: 'email' },
  phone: { label: 'Telefone comercial', type: 'tel' },
  whatsapp: { label: 'WhatsApp comercial', type: 'tel' },
  birthday: { label: 'Data de nascimento do contato', type: 'date' },
} as const;
const contactNames = hostedBrandDraft.shape.contact.keyof().options;

function BrandEditor({
  record,
  onCancel,
  onSave,
}: {
  record: BrandRecord;
  onCancel: () => void;
  onSave: (values: HostedBrandDraft, logo: LogoChange) => Promise<void>;
}) {
  const prefix = useId();
  const [error, setError] = useState('');
  const [logo, setLogo] = useState<LogoChange>({ action: 'keep' });
  const selection = useLogoSelection((value) =>
    setLogo(value ? { action: 'replace', logo: value } : { action: 'keep' }),
  );
  const defaultValues: HostedBrandDraft = {
    service: '',
    contact: { ...record.contact, birthday: record.contact.birthday ?? '' },
  };
  const form = useForm({
    defaultValues,
    validators: { onSubmit: hostedBrandDraft },
    onSubmit: async ({ value }) => {
      try {
        setError('');
        await onSave(hostedBrandDraft.parse(value), logo);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Não foi possível salvar.');
      }
    },
  });
  return (
    <form
      aria-label="Editar serviço, contato e logo"
      className="tw:grid tw:gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <fieldset
            disabled={pending}
            className="tw:m-0 tw:grid tw:min-w-0 tw:gap-4 tw:border-0 tw:p-0"
          >
            <form.Field name="service">
              {(field) => (
                <Field id={`${prefix}-service`} label="Trocar serviço">
                  <Select
                    id={`${prefix}-service`}
                    value={field.state.value}
                    onChange={(event) =>
                      field.handleChange(hostedBrandDraft.shape.service.parse(event.target.value))
                    }
                  >
                    <option value="">
                      Manter {record.service ?? record.plan ?? 'serviço atual'}
                    </option>
                    {Object.values(companyService).map((service) => (
                      <option value={service} key={service}>
                        {service}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </form.Field>
            <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
              Contato comercial do Admin. Estes dados não concedem acesso ao Workspace.
            </p>
            <div className="tw:grid tw:grid-cols-2 tw:gap-4 tw:mobile:grid-cols-1">
              {contactNames.map((name) => (
                <form.Field key={name} name={`contact.${name}`}>
                  {(field) => {
                    const id = `${prefix}-${name}`;
                    const message = field.state.meta.errors[0]?.message;
                    return (
                      <Field id={id} label={contactFields[name].label} error={message}>
                        <Input
                          id={id}
                          type={contactFields[name].type}
                          value={field.state.value}
                          aria-invalid={Boolean(message)}
                          aria-describedby={message ? `${id}-error` : undefined}
                          onChange={(event) => field.handleChange(event.target.value)}
                        />
                      </Field>
                    );
                  }}
                </form.Field>
              ))}
            </div>
            <LogoPicker
              hosted
              value={logo.action === 'replace' ? logo.logo : null}
              selection={selection}
              disabled={pending}
            />
            {record.hasLogo && logo.action !== 'replace' && (
              <Button
                variant="secondary"
                disabled={selection.reading}
                className="tw:justify-self-start"
                onClick={() => setLogo({ action: logo.action === 'remove' ? 'keep' : 'remove' })}
              >
                {logo.action === 'remove' ? 'Manter logo atual' : 'Remover logo atual'}
              </Button>
            )}
            {error && <FeedbackState kind="error">{error}</FeedbackState>}
            <div className="tw:flex tw:flex-wrap tw:gap-2">
              <Button
                type="submit"
                pending={pending}
                disabled={selection.reading || Boolean(selection.error)}
              >
                Salvar serviço, contato e logo
              </Button>
              <Button variant="secondary" onClick={onCancel}>
                Cancelar edição
              </Button>
            </div>
          </fieldset>
        )}
      </form.Subscribe>
    </form>
  );
}

export function HostedBrand({ companyId }: { companyId: string }) {
  const { available, query, update } = useHostedBrand(companyId);
  const [editing, setEditing] = useState<BrandRecord | null>(null);
  const heading = useId();
  if (!available) return null;
  const record = query.data;
  return (
    <section
      aria-labelledby={heading}
      aria-busy={query.isFetching}
      className="tw:grid tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4"
    >
      <h2 id={heading} className="tw:m-0 tw:text-section tw:font-bold tw:text-brand">
        Serviço, contato e logo
      </h2>
      {query.isPending && (
        <FeedbackState kind="loading">Carregando serviço, contato e logo…</FeedbackState>
      )}
      {query.isError && (
        <FeedbackState kind="error" onRetry={() => void query.refetch()}>
          Não foi possível carregar serviço, contato e logo.
        </FeedbackState>
      )}
      {editing && (
        <BrandEditor
          record={editing}
          onCancel={() => setEditing(null)}
          onSave={async (values, logo) => {
            await update.mutateAsync({ record: editing, values, logo });
            setEditing(null);
          }}
        />
      )}
      {record && !editing && (
        <>
          <dl className="tw:m-0 tw:grid tw:grid-cols-2 tw:gap-3 tw:mobile:grid-cols-1 tw:[&_dd]:m-0 tw:[&_dd]:wrap-anywhere tw:[&_dt]:text-caption tw:[&_dt]:text-muted-copy">
            <div>
              <dt>Serviço contratado</dt>
              <dd>{record.service ?? record.plan ?? 'Não informado'}</dd>
            </div>
            <div>
              <dt>Logo</dt>
              <dd>{record.hasLogo ? 'Cadastrada' : 'Não cadastrada'}</dd>
            </div>
            {contactNames.map((name) => (
              <div key={name}>
                <dt>{contactFields[name].label}</dt>
                <dd>{record.contact[name] || 'Não informado'}</dd>
              </div>
            ))}
          </dl>
          <Button
            variant="secondary"
            className="tw:justify-self-start"
            onClick={() => {
              update.reset();
              setEditing(record);
            }}
          >
            Editar serviço, contato e logo
          </Button>
          {update.isSuccess && (
            <FeedbackMessage tone="success">Serviço, contato e logo salvos.</FeedbackMessage>
          )}
        </>
      )}
    </section>
  );
}
