import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from 'react';

type FileInputProps = Omit<
  ComponentPropsWithoutRef<'input'>,
  'type' | 'children' | 'value' | 'defaultValue'
>;

export function FileInput({ className = '', form, multiple, onChange, ...props }: FileInputProps) {
  const input = useRef<HTMLInputElement>(null);
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    const element = input.current;
    const owner = element?.form;
    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    function syncAfterReset() {
      clearTimeout(resetTimer);
      // The browser clears files after dispatching the cancelable reset event.
      resetTimer = setTimeout(() => {
        setNames(Array.from(element?.files ?? [], (file) => file.name));
      }, 0);
    }
    owner?.addEventListener('reset', syncAfterReset);
    return () => {
      clearTimeout(resetTimer);
      owner?.removeEventListener('reset', syncAfterReset);
    };
  }, [form]);

  return (
    <span className={`tw:relative tw:grid tw:min-w-0 ${className}`}>
      <input
        {...props}
        ref={input}
        form={form}
        multiple={multiple}
        type="file"
        className="tw:peer tw:absolute tw:inset-0 tw:z-10 tw:m-0 tw:size-full tw:cursor-pointer tw:opacity-0 tw:disabled:cursor-not-allowed"
        onChange={(event) => {
          onChange?.(event);
          setNames(Array.from(event.currentTarget.files ?? [], (file) => file.name));
        }}
      />
      <span
        aria-hidden="true"
        className="tw:flex tw:min-h-control tw:min-w-0 tw:flex-wrap tw:items-center tw:gap-2 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-2 tw:text-body tw:text-copy tw:peer-focus-visible:outline-2 tw:peer-focus-visible:outline-offset-2 tw:peer-focus-visible:outline-focus tw:peer-disabled:opacity-65 tw:peer-aria-invalid:border-action-primary"
      >
        <span className="tw:rounded-control tw:border tw:border-action-primary tw:px-3 tw:py-2 tw:font-medium tw:text-action-primary">
          {multiple ? 'Selecionar arquivos' : 'Selecionar arquivo'}
        </span>
        <span className="tw:min-w-0 tw:flex-1 tw:text-caption tw:wrap-anywhere tw:text-muted-copy">
          {names.length ? names.join(', ') : 'Nenhum arquivo selecionado'}
        </span>
      </span>
    </span>
  );
}
