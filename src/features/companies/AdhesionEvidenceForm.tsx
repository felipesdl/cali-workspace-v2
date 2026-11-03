import { type WorkspaceAdhesionRecord } from '../../api/modules/access/adhesion';
import { type CompanyDocument } from '../../api/modules/companies/document-schemas';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';
import { Checkbox } from '../../components/ds/checkbox/Checkbox';
import { useAdhesionEvidenceForm } from './hooks/useAdhesionEvidenceForm';
export function AdhesionEvidenceForm({
  companyId,
  references,
  documents,
  onClose,
}: {
  companyId: string;
  references: WorkspaceAdhesionRecord[];
  documents: CompanyDocument[];
  onClose: (saved: boolean) => void;
}) {
  const { form, confirm } = useAdhesionEvidenceForm(companyId, onClose);
  return (
    <form
      aria-label="Conferir adesão da empresa"
      className="tw:my-4 tw:grid tw:gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
        Conferência administrativa demonstrativa. Registre como a formalização foi conferida. Anexo
        é opcional; esta confirmação não valida assinatura nem aceita termos pela pessoa.
      </p>
      <fieldset
        disabled={confirm.isPending}
        className="tw:m-0 tw:grid tw:min-w-0 tw:gap-4 tw:border-0 tw:p-0"
      >
        <form.Field name="adhesionId">
          {(field) => (
            <Field
              id="evidence-reference-id"
              label="Referência a comprovar"
              error={field.state.meta.errors[0]?.message}
            >
              <select
                id="evidence-reference-id"
                autoFocus
                required
                value={field.state.value}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                  form.setFieldValue('confirmed', false);
                }}
                aria-invalid={field.state.meta.errors.length > 0}
                aria-describedby={
                  field.state.meta.errors.length ? 'evidence-reference-id-error' : undefined
                }
              >
                <option value="">Selecione a referência</option>
                {references.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.evidenceReference}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </form.Field>
        <form.Field name="documentVersionId">
          {(field) => (
            <Field id="evidence-document-version" label="Arquivo vinculado (opcional)">
              <select
                id="evidence-document-version"
                value={field.state.value}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                  form.setFieldValue('confirmed', false);
                }}
              >
                <option value="">Conferência por referência externa, sem anexo</option>
                {documents
                  .filter((item) => item.isCurrent && !item.withdrawn)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.file.fileName} · versão {item.version}
                    </option>
                  ))}
              </select>
            </Field>
          )}
        </form.Field>
        <form.Field name="reviewNote">
          {(field) => (
            <Field
              id="evidence-review-note"
              label="Como a adesão foi conferida"
              error={field.state.meta.errors[0]?.message}
            >
              <textarea
                id="evidence-review-note"
                rows={4}
                required
                value={field.state.value}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                  form.setFieldValue('confirmed', false);
                }}
                aria-invalid={field.state.meta.errors.length > 0}
                aria-describedby={
                  field.state.meta.errors.length ? 'evidence-review-note-error' : undefined
                }
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="confirmed">
          {(field) => (
            <Checkbox
              checked={field.state.value}
              onChange={(event) => field.handleChange(event.target.checked)}
              required
            >
              Confirmo que conferi a formalização indicada para esta empresa.
            </Checkbox>
          )}
        </form.Field>
      </fieldset>
      {confirm.isError && <p role="alert">{confirm.error.message}</p>}
      <div className="tw:flex tw:flex-wrap tw:gap-3">
        <form.Subscribe
          selector={(state) =>
            [state.canSubmit, state.isSubmitting, state.values.confirmed] as const
          }
        >
          {([canSubmit, pending, confirmed]) => (
            <Button
              type="submit"
              disabled={!canSubmit || !confirmed}
              pending={pending || confirm.isPending}
            >
              Confirmar comprovação
            </Button>
          )}
        </form.Subscribe>
        <Button variant="secondary" disabled={confirm.isPending} onClick={() => onClose(false)}>
          Cancelar comprovação
        </Button>
      </div>
    </form>
  );
}
