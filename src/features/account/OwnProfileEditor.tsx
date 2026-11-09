import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { type OwnProfileService } from '../../api/modules/access/own-profile';
import {
  ownProfileFields,
  ownProfilePatch,
  type OwnProfile,
  type OwnProfileValues,
} from '../../api/modules/access/own-profile-schemas';
import { useUpdateOwnProfile } from '../../api/modules/access/hooks/useUpdateOwnProfile';
import { Button } from '../../components/ds/button/Button';
import { FormActions } from '../../components/ds/button/FormActions';
import { FeedbackMessage } from '../../components/ds/feedback/FeedbackMessage';
import { Input } from '../../components/ds/field/Controls';
import { Field } from '../../components/ds/field/Field';

export function OwnProfileEditor({
  profile,
  update,
  close,
  reload,
}: {
  profile: OwnProfile;
  update: NonNullable<OwnProfileService['update']>;
  close: (saved: boolean) => void;
  reload: () => void;
}) {
  const [expected] = useState<OwnProfileValues>(() => ({
    full_name: profile.full_name,
    job_title: profile.job_title,
    phone: profile.phone,
    whatsapp: profile.whatsapp,
  }));
  const mutation = useUpdateOwnProfile(profile.id, update, expected);
  const conflict = mutation.data?.status === 'conflict';
  const form = useForm({
    defaultValues: {
      full_name: expected.full_name ?? '',
      job_title: expected.job_title ?? '',
      phone: expected.phone ?? '',
      whatsapp: expected.whatsapp ?? '',
    },
    onSubmit: async ({ value }) => {
      const fields = ownProfileFields.filter(({ name }) => value[name] !== (expected[name] ?? ''));
      const patch = ownProfilePatch.parse(
        Object.fromEntries(
          fields.map(({ name }) => [
            name,
            name === 'full_name' ? value[name].trim() : value[name].trim() || null,
          ]),
        ),
      );
      if (!fields.length) return;
      try {
        const result = await mutation.mutateAsync(patch);
        if (result.status === 'saved') close(true);
      } catch {
        // A mutation exibe o erro e mantém o rascunho para nova tentativa.
      }
    },
  });

  return (
    <form
      aria-label="Editar meu perfil"
      className="tw:grid tw:gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!conflict && !mutation.isPending) void form.handleSubmit();
      }}
    >
      <div className="tw:grid tw:gap-4 tw:wide:grid-cols-2">
        {ownProfileFields.map(({ name, label, autoComplete, maxLength, type }) => (
          <form.Field
            key={name}
            name={name}
            validators={{
              onChange: ({ value }) => {
                if (value === (expected[name] ?? '')) return undefined;
                if (name === 'full_name' && !value.trim()) return 'Informe seu nome.';
                if (value.trim().length > maxLength) return `Use até ${maxLength} caracteres.`;
              },
            }}
          >
            {(field) => {
              const id = `own-profile-${name}`;
              const error = field.state.meta.errors[0];
              return (
                <Field id={id} label={label} error={error}>
                  <Input
                    id={id}
                    name={name}
                    type={type}
                    autoComplete={autoComplete}
                    autoFocus={name === 'full_name'}
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.currentTarget.value)}
                    onBlur={field.handleBlur}
                    disabled={mutation.isPending}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${id}-error` : undefined}
                  />
                </Field>
              );
            }}
          </form.Field>
        ))}
      </div>
      {mutation.isError && (
        <FeedbackMessage tone="error">
          Não foi possível salvar seu perfil. Tente novamente.
        </FeedbackMessage>
      )}
      {conflict && (
        <div className="tw:grid tw:justify-items-start tw:gap-3">
          <FeedbackMessage tone="error">
            Seu perfil mudou em outra sessão. Recarregue os dados antes de editar novamente.
          </FeedbackMessage>
          <Button variant="secondary" onClick={reload}>
            Descartar rascunho e recarregar
          </Button>
        </div>
      )}
      <FormActions className="tw:max-w-md">
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isDefaultValue, state.isSubmitting] as const}
        >
          {([canSubmit, unchanged, submitting]) => (
            <Button
              type="submit"
              disabled={!canSubmit || unchanged || conflict}
              pending={submitting || mutation.isPending}
            >
              Salvar perfil
            </Button>
          )}
        </form.Subscribe>
        <Button variant="secondary" disabled={mutation.isPending} onClick={() => close(false)}>
          Cancelar edição
        </Button>
      </FormActions>
    </form>
  );
}
