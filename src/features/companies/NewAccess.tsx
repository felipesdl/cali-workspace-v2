import { FeedbackMessage } from '../../components/ds/feedback/FeedbackMessage';
import { Input } from '../../components/ds/field/Controls';
import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { companyAccessFieldsSchema } from '../../api/modules/companies/management-schemas';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';
import { useAddCompanyAccess } from '../../api/modules/companies/hooks/useCompanyManagement';

export function NewAccess({
  companyId,
  onClose,
}: {
  companyId: string;
  onClose: (saved: boolean) => void;
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const add = useAddCompanyAccess();
  const form = useForm({
    defaultValues: { name: '', email: '' },
    validators: { onChange: companyAccessFieldsSchema, onSubmit: companyAccessFieldsSchema },
    onSubmit: async ({ value }) => {
      try {
        await add.mutateAsync({ requestId, companyId, values: value });
        onClose(true);
      } catch {
        /* Preserva rascunho; a fronteira de dados verifica adesão/limite novamente. */
      }
    },
  });
  return (
    <form
      aria-label="Autorizar acesso"
      className="tw:my-4 tw:grid tw:gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <div className="tw:grid tw:grid-cols-2 tw:gap-4 tw:mobile:grid-cols-1">
        {(
          [
            ['name', 'Nome da pessoa'],
            ['email', 'E-mail do acesso'],
          ] as const
        ).map(([name, label]) => (
          <form.Field key={name} name={name}>
            {(field) => {
              const error = field.state.meta.errors[0]?.message;
              const id = `new-access-${name}`;
              return (
                <Field id={id} label={label} error={error}>
                  <Input
                    id={id}
                    type={name === 'email' ? 'email' : 'text'}
                    autoFocus={name === 'name'}
                    required
                    autoComplete="off"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    disabled={add.isPending}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${id}-error` : undefined}
                  />
                </Field>
              );
            }}
          </form.Field>
        ))}
      </div>
      {add.isError && <FeedbackMessage tone="error">{add.error.message}</FeedbackMessage>}
      <div className="tw:flex tw:flex-wrap tw:gap-3">
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
          {([canSubmit, submitting]) => (
            <Button type="submit" disabled={!canSubmit} pending={submitting || add.isPending}>
              Confirmar autorização
            </Button>
          )}
        </form.Subscribe>
        <Button variant="secondary" disabled={add.isPending} onClick={() => onClose(false)}>
          Cancelar autorização
        </Button>
      </div>
    </form>
  );
}
