import { FeedbackMessage } from '../../components/ds/feedback/FeedbackMessage';
import { Input } from '../../components/ds/field/Controls';
import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { registerWorkspaceAdhesionSchema } from '../../api/modules/access/adhesion';
import { useRegisterCompanyAdhesion } from '../../api/modules/companies/hooks/useCompanyManagement';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';
export function AdhesionReferenceForm({
  companyId,
  onClose,
}: {
  companyId: string;
  onClose: () => void;
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const register = useRegisterCompanyAdhesion();
  const form = useForm({
    defaultValues: { evidenceReference: '' },
    validators: {
      onChange: registerWorkspaceAdhesionSchema.pick({ evidenceReference: true }),
      onSubmit: registerWorkspaceAdhesionSchema.pick({ evidenceReference: true }),
    },
    onSubmit: async ({ value }) => {
      try {
        await register.mutateAsync({ requestId, companyId, ...value });
        onClose();
      } catch {
        /* Rascunho preservado; nenhum aceite jurídico é criado. */
      }
    },
  });
  return (
    <form
      aria-label="Registrar referência de adesão"
      className="tw:mt-4 tw:grid tw:gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Field name="evidenceReference">
        {(field) => {
          const error = field.state.meta.errors[0]?.message;
          return (
            <Field id="adhesion-reference" label="Referência da formalização" error={error}>
              <Input
                id="adhesion-reference"
                autoFocus
                required
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                disabled={register.isPending}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'adhesion-reference-error' : 'adhesion-help'}
              />
            </Field>
          );
        }}
      </form.Field>
      <p id="adhesion-help" className="tw:m-0 tw:text-caption tw:text-muted-copy">
        Informe onde a formalização pode ser conferida. O registro da referência não valida o
        documento nem substitui o aceite individual dos termos.
      </p>
      {register.isError && <FeedbackMessage tone="error">{register.error.message}</FeedbackMessage>}
      <div className="tw:flex tw:flex-wrap tw:gap-3">
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
          {([canSubmit, submitting]) => (
            <Button type="submit" disabled={!canSubmit} pending={submitting || register.isPending}>
              Registrar referência
            </Button>
          )}
        </form.Subscribe>
        <Button variant="secondary" disabled={register.isPending} onClick={onClose}>
          Cancelar registro
        </Button>
      </div>
    </form>
  );
}
