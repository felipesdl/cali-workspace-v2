import { Input, Select, TextArea } from '../../../../components/ds/field/Controls';
import { Field } from '../../../../components/ds/field/Field';
type Base<Name extends string> = { name: Name; label: string; help?: string };
export type CompanyFieldDefinition<Name extends string> = Base<Name> &
  (
    | { control: 'select' | 'suggestion'; options: readonly { value: string; label: string }[] }
    | { control: 'text' | 'date' | 'decimal' | 'integer' | 'textarea' | 'email' }
  );
type CompanyFieldProps = {
  prefix: string;
  definition: CompanyFieldDefinition<string>;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error?: string;
  autoFocus?: boolean;
};
export function CompanyField({
  prefix,
  definition,
  value,
  onChange,
  onBlur,
  error,
  autoFocus,
}: CompanyFieldProps) {
  const id = `${prefix}-${definition.name}`;
  const helpId = definition.help ? `${id}-help` : undefined;
  const common = {
    id,
    name: definition.name,
    value,
    onBlur,
    autoFocus,
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? `${id}-error` : helpId,
  };
  function control() {
    if (definition.control === 'select')
      return (
        <Select {...common} onChange={(event) => onChange(event.target.value)}>
          {definition.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      );
    if (definition.control === 'suggestion')
      return (
        <>
          <Input
            {...common}
            list={`${id}-options`}
            autoComplete="off"
            onChange={(event) => onChange(event.target.value)}
          />
          <datalist id={`${id}-options`}>
            {definition.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </datalist>
        </>
      );
    if (definition.control === 'textarea')
      return <TextArea {...common} rows={3} onChange={(event) => onChange(event.target.value)} />;
    const modes = {
      text: 'text',
      email: 'email',
      date: 'text',
      decimal: 'decimal',
      integer: 'numeric',
    } as const;
    const type =
      definition.control === 'date' || definition.control === 'email' ? definition.control : 'text';
    return (
      <Input
        {...common}
        type={type}
        inputMode={modes[definition.control]}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  return (
    <div className="tw:min-w-0">
      <Field id={id} label={definition.label} error={error}>
        {control()}
      </Field>
      {definition.help && (
        <p id={`${id}-help`} className="tw:mt-2 tw:text-caption tw:text-muted-copy">
          {definition.help}
        </p>
      )}
    </div>
  );
}
