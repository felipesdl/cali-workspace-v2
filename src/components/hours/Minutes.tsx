export function Minutes({ value }: { value: number }) {
  const absolute = Math.abs(value);
  return (
    <>
      {value < 0 ? '−' : ''}
      {Math.floor(absolute / 60)} h {absolute % 60} min
    </>
  );
}
