import {
  type CompanyDocument,
  companyDocumentType,
} from '../../api/modules/companies/document-schemas';
import { useDocumentAttachment } from './hooks/useDocumentAttachment';
import { Field } from '../../components/ds/field/Field';
import { Button } from '../../components/ds/button/Button';
export function DocumentAttachmentForm({
  companyId,
  previous,
  onClose,
}: {
  companyId: string;
  previous: CompanyDocument | null;
  onClose: (saved: boolean) => void;
}) {
  const { form, file, choose, fileError, attach } = useDocumentAttachment(
    companyId,
    previous,
    onClose,
  );
  return (
    <form
      aria-label="Anexar documento contratual"
      className="tw:my-4 tw:grid tw:gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
        Arquivo sintético somente em memória, até 12 MB. Anexar não valida assinatura ou comprova
        adesão. Versões anteriores serão preservadas.
      </p>
      <fieldset
        disabled={attach.isPending}
        className="tw:m-0 tw:grid tw:min-w-0 tw:grid-cols-2 tw:gap-4 tw:border-0 tw:p-0 tw:mobile:grid-cols-1"
      >
        <form.Field name="documentType">
          {(field) => (
            <Field id="contract-document-type" label="Tipo do documento">
              <select
                id="contract-document-type"
                autoFocus={!previous}
                disabled={Boolean(previous)}
                value={field.state.value}
                onChange={(event) =>
                  field.handleChange(
                    companyDocumentType.Contract === event.target.value
                      ? companyDocumentType.Contract
                      : companyDocumentType.Addendum,
                  )
                }
              >
                <option value="contract">Contrato</option>
                <option value="addendum">Aditivo contratual</option>
              </select>
            </Field>
          )}
        </form.Field>
        <form.Field name="documentDate">
          {(field) => (
            <Field
              id="contract-document-date"
              label="Data do documento"
              error={field.state.meta.errors[0]?.message}
            >
              <input
                id="contract-document-date"
                autoFocus={Boolean(previous)}
                type="date"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                aria-invalid={field.state.meta.errors.length > 0}
                aria-describedby={
                  field.state.meta.errors.length ? 'contract-document-date-error' : undefined
                }
              />
            </Field>
          )}
        </form.Field>
        <Field id="contract-document-file" label="Arquivo do documento" error={fileError}>
          <input
            id="contract-document-file"
            type="file"
            accept=".pdf,.doc,.docx,image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
            aria-describedby={fileError ? 'contract-document-file-error' : 'contract-file-help'}
            onChange={(event) => {
              choose(event.currentTarget.files?.[0] ?? null);
              event.currentTarget.value = '';
            }}
          />
        </Field>
        <p id="contract-file-help" className="tw:text-caption tw:text-muted-copy">
          PDF, DOC, DOCX ou imagem.{' '}
          {file ? `Selecionado: ${file.name}` : 'Nenhum arquivo selecionado.'}
        </p>
      </fieldset>
      {attach.isError && <p role="alert">{attach.error.message}</p>}
      <div className="tw:flex tw:flex-wrap tw:gap-3">
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
          {([canSubmit, pending]) => (
            <Button
              type="submit"
              disabled={!canSubmit || !file}
              pending={pending || attach.isPending}
            >
              Confirmar anexo
            </Button>
          )}
        </form.Subscribe>
        <Button variant="secondary" disabled={attach.isPending} onClick={() => onClose(false)}>
          Cancelar anexo
        </Button>
      </div>
    </form>
  );
}
