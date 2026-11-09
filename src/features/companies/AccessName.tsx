import { FeedbackMessage } from '../../components/ds/feedback/FeedbackMessage';
import { Input } from '../../components/ds/field/Controls';
import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { companyAccessFieldsSchema } from '../../api/modules/companies/management-schemas';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';
import { type CompanyAccess } from '../../api/modules/companies/schemas';
import { useChangeCompanyAccess } from '../../api/modules/companies/hooks/useCompanyManagement';

export function AccessName({
  access,
  onClose,
}: {
  access: CompanyAccess;
  onClose: (saved: boolean) => void;
}) {
  const [original] = useState(() => structuredClone(access));
  const [requestId] = useState(() => crypto.randomUUID());
  const change = useChangeCompanyAccess();
  const form = useForm({
    defaultValues: { name: original.name },
    validators: {
      onChange: companyAccessFieldsSchema.pick({ name: true }),
      onSubmit: companyAccessFieldsSchema.pick({ name: true }),
    },
    onSubmit: async ({ value }) => {
      try {
        await change.mutateAsync({
          requestId,
          companyId: original.companyId,
          accessId: original.id,
          expected: { name: original.name, email: original.email, status: original.status },
          values: { name: value.name, status: original.status },
        });
        onClose(true);
      } catch {
        /* Não substitui rascunho após erro ou conflito. */
      }
    },
  });
  return (
    <form
      aria-label={`Editar nome de ${access.email}`}
      className="tw:mt-3 tw:grid tw:gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Field name="name">
        {(field) => {
          const id = `access-name-${access.id}`;
          const error = field.state.meta.errors[0]?.message;
          return (
            <Field id={id} label="Nome do acesso" error={error}>
              <Input
                id={id}
                autoFocus
                required
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                disabled={change.isPending}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${id}-error` : undefined}
              />
            </Field>
          );
        }}
      </form.Field>
      {change.isError && <FeedbackMessage tone="error">{change.error.message}</FeedbackMessage>}
      <div className="tw:flex tw:flex-wrap tw:gap-3">
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
          {([canSubmit, submitting]) => (
            <Button type="submit" disabled={!canSubmit} pending={submitting || change.isPending}>
              Salvar nome
            </Button>
          )}
        </form.Subscribe>
        <Button variant="secondary" disabled={change.isPending} onClick={() => onClose(false)}>
          Cancelar nome
        </Button>
      </div>
    </form>
  );
}
