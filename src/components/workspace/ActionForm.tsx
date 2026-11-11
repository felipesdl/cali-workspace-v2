import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../ds/button/Button';
import { FeedbackMessage } from '../ds/feedback/FeedbackMessage';
import { Dialog } from '../ds/dialog/Dialog';

export function ActionForm<T>({
  label,
  submit,
  children,
  saved,
  success = 'Operação concluída.',
  dialog,
}: {
  label: string;
  submit: (values: FormData, id: string) => Promise<T>;
  children?: (fieldId: string) => ReactNode;
  saved?: (result: T) => void;
  success?: string;
  dialog?: { title: string; trigger: string };
}) {
  const prefix = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const mutation = useMutation({
    mutationFn: (values: FormData) => submit(values, requestId),
    onSuccess: (result) => {
      setRequestId(crypto.randomUUID());
      setOpen(false);
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

  const feedback = (isError || isSuccess) && (
    <FeedbackMessage ref={resultRef} tabIndex={-1} tone={isError ? 'error' : 'success'}>
      {isError ? mutation.error.message : success}
    </FeedbackMessage>
  );
  const form = (
    <form
      ref={formRef}
      className={`tw:box-border tw:grid tw:w-full tw:max-w-2xl tw:min-w-0 tw:gap-3 tw:wrap-anywhere ${
        dialog ? '' : 'tw:rounded-control tw:border tw:border-border-default tw:p-4'
      }`}
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
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          {dialog && (
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Voltar
            </Button>
          )}
          <Button type="submit" className="tw:max-w-full" pending={mutation.isPending}>
            {mutation.isPending ? 'Salvando…' : label}
          </Button>
        </div>
      </fieldset>
      {(!dialog || isError) && feedback}
    </form>
  );
  if (!dialog) return form;
  return (
    <div className="tw:grid tw:justify-items-start tw:gap-2">
      <Button
        aria-haspopup="dialog"
        onClick={() => {
          mutation.reset();
          setOpen(true);
        }}
      >
        {dialog.trigger}
      </Button>
      {open && (
        <Dialog title={dialog.title} pending={mutation.isPending} onDismiss={() => setOpen(false)}>
          {form}
        </Dialog>
      )}
      {!open && isSuccess && feedback}
    </div>
  );
}
