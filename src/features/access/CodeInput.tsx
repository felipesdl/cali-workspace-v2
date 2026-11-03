type CodeInputProps = { id: string; value: string; onChange: (value: string) => void };

export function CodeInput({ id, value, onChange }: CodeInputProps) {
  return (
    <input
      id={id}
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]{6}"
      minLength={6}
      maxLength={6}
      required
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
