import { Input } from '../../components/ds/field/Controls';
type CodeInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  length?: 6 | 8;
  autoFocus?: boolean;
};

export function CodeInput({ id, value, onChange, length = 6, autoFocus }: CodeInputProps) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern={`[0-9]{${length}}`}
      minLength={length}
      maxLength={length}
      required
      autoFocus={autoFocus}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
