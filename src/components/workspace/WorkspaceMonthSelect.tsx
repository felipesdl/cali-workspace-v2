import { Input } from '../ds/field/Controls';
import { Field } from '../ds/field/Field';

export function MonthSelect({
  month,
  update,
}: {
  month: string;
  update: (change: { month: string; page: number }) => void;
}) {
  return (
    <Field id="phase4-month" label="Mês de referência">
      <Input
        id="phase4-month"
        type="month"
        value={month.slice(0, 7)}
        onChange={(event) => {
          const value = event.currentTarget.value;
          if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) update({ month: `${value}-01`, page: 1 });
        }}
      />
    </Field>
  );
}
