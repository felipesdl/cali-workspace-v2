import { useEffect, useRef, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { companyBasicFieldsSchema } from '../../api/modules/companies/schemas';
import {
  useCompanyManagementAvailable,
  useCreateCompany,
} from '../../api/modules/companies/hooks/useCompanyManagement';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';

function RegistrationForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (companyId: string) => Promise<void>;
}) {
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [requestId] = useState(() => crypto.randomUUID());
  const create = useCreateCompany();
  const form = useForm({
    defaultValues: { displayName: '', legalName: '' },
    validators: { onChange: companyBasicFieldsSchema, onSubmit: companyBasicFieldsSchema },
    onSubmit: async ({ value }) => {
      try {
        const company = await create.mutateAsync({ requestId, values: value });
        if (!active.current) return;
        await onCreated(company.id);
        onClose();
      } catch {
        /* Erro da mutation mantém rascunho e não repete a criação. */
      }
    },
  });
  return (
    <form
      aria-label="Cadastrar empresa"
      className="tw:mt-4 tw:grid tw:gap-4 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <h2 className="tw:m-0 tw:text-section tw:font-bold tw:text-brand">Nova empresa</h2>
      <p className="tw:m-0">
        Cadastre a identificação. A adesão e os acessos serão registrados na ficha da empresa.
      </p>
      <div className="tw:grid tw:grid-cols-2 tw:gap-4 tw:mobile:grid-cols-1">
        {(
          [
            ['displayName', 'Nome de apresentação'],
            ['legalName', 'Razão social'],
          ] as const
        ).map(([name, label]) => (
          <form.Field key={name} name={name}>
            {(field) => {
              const error = field.state.meta.errors[0]?.message;
              const id = `registration-${name}`;
              return (
                <Field id={id} label={label} error={error}>
                  <input
                    id={id}
                    value={field.state.value}
                    autoFocus={name === 'displayName'}
                    autoComplete="off"
                    required={name === 'displayName'}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    disabled={create.isPending}
                    aria-invalid={Boolean(error)}
                    aria-describedby={
                      error ? `${id}-error` : name === 'legalName' ? 'registration-help' : undefined
                    }
                  />
                </Field>
              );
            }}
          </form.Field>
        ))}
      </div>
      <p id="registration-help" className="tw:m-0 tw:text-caption tw:text-muted-copy">
        Se a razão social ficar em branco, será usado o nome de apresentação.
      </p>
      {create.isError && <p role="alert">{create.error.message}</p>}
      <div className="tw:flex tw:flex-wrap tw:gap-3">
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
          {([canSubmit, submitting]) => (
            <Button type="submit" disabled={!canSubmit} pending={submitting || create.isPending}>
              Confirmar cadastro
            </Button>
          )}
        </form.Subscribe>
        <Button variant="secondary" disabled={create.isPending} onClick={onClose}>
          Cancelar cadastro
        </Button>
      </div>
    </form>
  );
}

export function CompanyRegistration({
  onCreated,
}: {
  onCreated: (companyId: string) => Promise<void>;
}) {
  const available = useCompanyManagementAvailable();
  const [open, setOpen] = useState(false);
  const region = useRef<HTMLDivElement>(null);
  if (!available) return null;
  return (
    <div ref={region} role="group" tabIndex={-1} aria-label="Cadastro de empresa">
      <Button onClick={() => setOpen(true)} disabled={open}>
        Cadastrar empresa
      </Button>
      {open && (
        <RegistrationForm
          onCreated={onCreated}
          onClose={() => {
            setOpen(false);
            requestAnimationFrame(() => region.current?.focus());
          }}
        />
      )}
    </div>
  );
}
