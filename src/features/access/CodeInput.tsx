type CodeInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  length?: 6 | 8;
};

export function CodeInput({ id, value, onChange, length = 6 }: CodeInputProps) {
  return (
    <input
      id={id}
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern={`[0-9]{${length}}`}
      minLength={length}
      maxLength={length}
      required
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
