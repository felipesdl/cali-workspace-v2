import { type CompanyAdministration } from '../../api/modules/companies/administration-schemas';
import { Button } from '../../components/ds/button/Button';
import { useAdministrationEditor } from './hooks/useAdministrationEditor';
import { administrationGroups } from './administration-fields';
import { AdministrationFields } from './AdministrationFields';

export function AdministrationEditor({
  record,
  onClose,
  onReload,
}: {
  record: CompanyAdministration;
  onClose: (saved: boolean) => void;
  onReload: () => void;
}) {
  const { form, update } = useAdministrationEditor(record, onClose);
  return (
    <form
      aria-label="Editar ficha administrativa"
      className="tw:grid tw:gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
        Somente dados sintéticos nesta demonstração. Campos não informados permanecem em branco;
        números sem separador de milhar. Salvar registra a ficha inteira.
      </p>
      {administrationGroups.map((group) => (
        <AdministrationFields key={group.title} {...group} form={form} pending={update.isPending} />
      ))}
      {update.isError && (
        <div role="alert">
          <p>{update.error.message}</p>
          <Button variant="secondary" onClick={onReload}>
            Descartar ficha e recarregar
          </Button>
        </div>
      )}
      <div className="tw:flex tw:flex-wrap tw:gap-3">
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
          {([canSubmit, submitting]) => (
            <Button type="submit" disabled={!canSubmit} pending={submitting || update.isPending}>
              Salvar ficha administrativa
            </Button>
          )}
        </form.Subscribe>
        <Button variant="secondary" disabled={update.isPending} onClick={() => onClose(false)}>
          Cancelar ficha
        </Button>
      </div>
    </form>
  );
}
