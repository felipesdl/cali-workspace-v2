import { FileInput } from '../../components/ds/field/FileInput';
import { type CompanyLogo } from '../../api/modules/companies/registration-schemas';
import { type useLogoSelection } from './hooks/useLogoSelection';
import { LogoPreview } from './LogoPreview';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';
export function LogoPicker({
  value,
  selection,
  disabled,
  error,
  hosted = false,
}: {
  value: CompanyLogo | null;
  selection: ReturnType<typeof useLogoSelection>;
  disabled: boolean;
  error?: string;
  hosted?: boolean;
}) {
  const message = selection.error || error;
  return (
    <fieldset disabled={disabled} className="tw:m-0 tw:grid tw:min-w-0 tw:gap-3 tw:border-0 tw:p-0">
      <legend className="tw:mb-2 tw:text-section tw:font-semibold tw:text-brand">
        Logo da empresa
      </legend>
      <LogoPreview logo={value} alt="Prévia da logo da empresa" />
      <Field id="registration-logo-file" label="Selecionar logo" error={message}>
        <FileInput
          id="registration-logo-file"
          accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
          aria-invalid={Boolean(message)}
          aria-describedby={message ? 'registration-logo-file-error' : 'registration-logo-help'}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) void selection.choose(file);
          }}
        />
      </Field>
      <p id="registration-logo-help" className="tw:m-0 tw:text-caption tw:text-muted-copy">
        JPG, PNG, WEBP, AVIF ou SVG, até 12 MB. Preparada localmente em até 1200 px e 700 KB; SVG
        vira imagem raster.{' '}
        {hosted
          ? 'Ao salvar, a imagem vai para o armazenamento privado da empresa.'
          : 'A logo só é registrada ao salvar o cadastro, sem upload.'}
      </p>
      {selection.reading && <p role="status">Preparando logo…</p>}
      {(value || selection.reading) && (
        <Button variant="secondary" className="tw:justify-self-start" onClick={selection.remove}>
          Remover logo do rascunho
        </Button>
      )}
    </fieldset>
  );
}
