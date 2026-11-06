import { useId, useState, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../../components/ds/button/Button';

export function ActionForm<T>({
  label,
  submit,
  children,
  saved,
}: {
  label: string;
  submit: (values: FormData, id: string) => Promise<T>;
  children?: (fieldId: string) => ReactNode;
  saved?: (result: T) => void;
}) {
  const prefix = useId();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const mutation = useMutation({
    mutationFn: (values: FormData) => submit(values, requestId),
    onSuccess: (result) => {
      setRequestId(crypto.randomUUID());
      saved?.(result);
    },
  });
  return (
    <form
      className="tw:grid tw:max-w-2xl tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:p-4"
      aria-label={label}
      onSubmit={(event) => {
        event.preventDefault();
        if (!mutation.isPending) mutation.mutate(new FormData(event.currentTarget));
      }}
    >
      <fieldset key={requestId} disabled={mutation.isPending} className="tw:grid tw:gap-3">
        {children?.(prefix)}
        <div>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Salvando…' : label}
          </Button>
        </div>
      </fieldset>
      {mutation.isSuccess && <p role="status">Operação concluída.</p>}
      {mutation.isError && <p role="alert">{mutation.error.message}</p>}
    </form>
  );
}
