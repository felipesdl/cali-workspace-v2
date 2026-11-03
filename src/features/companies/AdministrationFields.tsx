import { type AdministrationFieldDefinition } from './administration-fields';
import { type useAdministrationEditor } from './hooks/useAdministrationEditor';
import { CompanyField } from './CompanyField';

type AdministrationFieldsProps = {
  title: string;
  description: string;
  fields: readonly AdministrationFieldDefinition[];
  form: ReturnType<typeof useAdministrationEditor>['form'];
  pending: boolean;
};
export function AdministrationFields({
  title,
  description,
  fields,
  form,
  pending,
}: AdministrationFieldsProps) {
  return (
    <fieldset disabled={pending} className="tw:m-0 tw:min-w-0 tw:border-0 tw:p-0">
      <legend className="tw:mb-2 tw:text-section tw:font-semibold tw:text-brand">{title}</legend>
      <p className="tw:mb-4 tw:text-caption tw:text-muted-copy">{description}</p>
      <div className="tw:grid tw:grid-cols-2 tw:gap-4 tw:mobile:grid-cols-1">
        {fields.map((definition) => (
          <form.Field key={definition.name} name={definition.name}>
            {(field) => {
              const error = field.state.meta.errors[0]?.message;
              return (
                <CompanyField
                  prefix="administration"
                  definition={definition}
                  value={field.state.value}
                  onChange={field.handleChange}
                  onBlur={field.handleBlur}
                  error={error}
                  autoFocus={definition.name === 'startDate'}
                />
              );
            }}
          </form.Field>
        ))}
      </div>
    </fieldset>
  );
}
