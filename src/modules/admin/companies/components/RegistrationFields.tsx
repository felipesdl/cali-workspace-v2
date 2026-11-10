import { type useRegistrationEditor } from '../hooks/useRegistrationEditor';
import { type RegistrationFieldDefinition } from './registration-fields';
import { CompanyField } from './CompanyField';
export function RegistrationFields({
  title,
  description,
  fields,
  form,
  pending,
}: {
  title: string;
  description: string;
  fields: readonly RegistrationFieldDefinition[];
  form: ReturnType<typeof useRegistrationEditor>['form'];
  pending: boolean;
}) {
  return (
    <fieldset disabled={pending} className="tw:m-0 tw:min-w-0 tw:border-0 tw:p-0">
      <legend className="tw:mb-2 tw:text-section tw:font-semibold tw:text-brand">{title}</legend>
      <p className="tw:mb-4 tw:text-caption tw:text-muted-copy">{description}</p>
      <div className="tw:grid tw:grid-cols-2 tw:gap-4 tw:mobile:grid-cols-1">
        {fields.map((definition) => (
          <form.Field key={definition.name} name={definition.name}>
            {(field) => (
              <CompanyField
                prefix="registration"
                definition={definition}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]?.message}
                autoFocus={definition.name === 'service'}
              />
            )}
          </form.Field>
        ))}
      </div>
    </fieldset>
  );
}
