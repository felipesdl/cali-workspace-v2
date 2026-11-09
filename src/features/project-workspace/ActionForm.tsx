import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../../components/ds/button/Button';

export function ActionForm<T>({
  label,
  submit,
  children,
  saved,
  success = 'Operação concluída.',
}: {
  label: string;
  submit: (values: FormData, id: string) => Promise<T>;
  children?: (fieldId: string) => ReactNode;
  saved?: (result: T) => void;
  success?: string;
}) {
  const prefix = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLParagraphElement>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const mutation = useMutation({
    mutationFn: (values: FormData) => submit(values, requestId),
    onSuccess: (result) => {
      setRequestId(crypto.randomUUID());
      saved?.(result);
    },
  });
  const { isError, isSuccess } = mutation;
  useEffect(() => {
    if (!isError && !isSuccess) return;
    const focused = document.activeElement;
    if (focused === document.body || formRef.current?.contains(focused)) {
      resultRef.current?.focus();
    }
  }, [isError, isSuccess]);

  return (
    <form
      ref={formRef}
      className="tw:box-border tw:grid tw:w-full tw:max-w-2xl tw:min-w-0 tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:p-4 tw:wrap-anywhere"
      aria-label={label}
      onSubmit={(event) => {
        event.preventDefault();
        if (!mutation.isPending) mutation.mutate(new FormData(event.currentTarget));
      }}
    >
      <fieldset
        key={requestId}
        disabled={mutation.isPending}
        className="tw:m-0 tw:grid tw:min-w-0 tw:gap-3 tw:border-0 tw:p-0"
      >
        {children?.(prefix)}
        <div>
          <Button type="submit" className="tw:max-w-full" pending={mutation.isPending}>
            {mutation.isPending ? 'Salvando…' : label}
          </Button>
        </div>
      </fieldset>
      {(isError || isSuccess) && (
        <p
          ref={resultRef}
          tabIndex={-1}
          role={isError ? 'alert' : 'status'}
          className="tw:m-0 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-3 tw:text-caption tw:leading-note"
        >
          {isError ? mutation.error.message : success}
        </p>
      )}
    </form>
  );
}
