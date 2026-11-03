import { type AdministrationFieldDefinition } from './administration-fields';
import { type useAdministrationEditor } from './hooks/useAdministrationEditor';
import { Field } from '../../components/ds/field/Field';

type ControlProps = {
  definition: AdministrationFieldDefinition;
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  invalid: boolean;
  describedBy?: string;
};
function AdministrationControl({ definition, value, onChange, ...props }: ControlProps) {
  const common = {
    id: props.id,
    name: definition.name,
    onBlur: props.onBlur,
    value,
    'aria-invalid': props.invalid,
    'aria-describedby': props.describedBy,
  };
  if (definition.control === 'select')
    return (
      <select {...common} onChange={(event) => onChange(event.target.value)}>
        {definition.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  if (definition.control === 'textarea')
    return <textarea {...common} rows={3} onChange={(event) => onChange(event.target.value)} />;
  const inputModes = {
    text: 'text',
    date: 'text',
    decimal: 'decimal',
    integer: 'numeric',
  } as const;
  return (
    <input
      {...common}
      type={definition.control === 'date' ? 'date' : 'text'}
      inputMode={inputModes[definition.control]}
      autoComplete="off"
      autoFocus={definition.name === 'startDate'}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

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
              const id = `administration-${definition.name}`;
              const description = error ? `${id}-error` : undefined;
              return (
                <div className="tw:min-w-0">
                  <Field id={id} label={definition.label} error={error}>
                    <AdministrationControl
                      definition={definition}
                      id={id}
                      value={field.state.value}
                      onChange={field.handleChange}
                      onBlur={field.handleBlur}
                      invalid={Boolean(error)}
                      describedBy={description ?? (definition.help ? `${id}-help` : undefined)}
                    />
                  </Field>
                  {definition.help && (
                    <p id={`${id}-help`} className="tw:mt-2 tw:text-caption tw:text-muted-copy">
                      {definition.help}
                    </p>
                  )}
                </div>
              );
            }}
          </form.Field>
        ))}
      </div>
    </fieldset>
  );
}
