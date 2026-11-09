import { FeedbackMessage } from '../../components/ds/feedback/FeedbackMessage';
import { type CompanyRegistrationRecord } from '../../api/modules/companies/registration-schemas';
import { useRegistrationEditor } from './hooks/useRegistrationEditor';
import { registrationGroups } from './registration-fields';
import { RegistrationFields } from './RegistrationFields';
import { LogoPicker } from './LogoPicker';
import { Button } from '../../components/ds/button/Button';
export function RegistrationEditor({
  record,
  onClose,
  onReload,
}: {
  record: CompanyRegistrationRecord;
  onClose: (saved: boolean) => void;
  onReload: () => void;
}) {
  const { form, update, logo } = useRegistrationEditor(record, onClose);
  return (
    <form
      aria-label="Editar dados cadastrais"
      className="tw:grid tw:gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!logo.reading) void form.handleSubmit();
      }}
    >
      <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
        Somente dados sintéticos. Este cadastro não altera autorizações de acesso nem ativa
        comunicações ou agenda.
      </p>
      {registrationGroups.map((group) => (
        <RegistrationFields key={group.title} {...group} form={form} pending={update.isPending} />
      ))}
      <form.Field name="logo">
        {(field) => (
          <LogoPicker
            value={field.state.value}
            selection={logo}
            disabled={update.isPending}
            error={field.state.meta.errors[0]?.message}
          />
        )}
      </form.Field>
      {update.isError && (
        <div className="tw:grid tw:justify-items-start tw:gap-2">
          <FeedbackMessage tone="error" className="tw:justify-self-stretch">
            {update.error.message}
          </FeedbackMessage>
          <Button variant="secondary" onClick={onReload}>
            Descartar cadastro e recarregar
          </Button>
        </div>
      )}
      <div className="tw:flex tw:flex-wrap tw:gap-3">
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
          {([canSubmit, pending]) => (
            <Button
              type="submit"
              disabled={!canSubmit || logo.reading}
              pending={pending || update.isPending}
            >
              Salvar dados cadastrais
            </Button>
          )}
        </form.Subscribe>
        <Button variant="secondary" disabled={update.isPending} onClick={() => onClose(false)}>
          Cancelar cadastro da empresa
        </Button>
      </div>
    </form>
  );
}
