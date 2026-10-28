import { type ReactNode } from 'react';

type FieldProps = {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
};

export function Field({ id, label, error, children }: FieldProps) {
  return (
    <div className="tw:grid tw:gap-2 tw:[&_:is(input,select)]:box-border tw:[&_:is(input,select)]:min-h-control tw:[&_:is(input,select)]:w-full tw:[&_:is(input,select)]:min-w-0 tw:[&_:is(input,select)]:rounded-control tw:[&_:is(input,select)]:border tw:[&_:is(input,select)]:border-border-default tw:[&_:is(input,select)]:bg-panel tw:[&_:is(input,select)]:px-3 tw:[&_:is(input,select)]:py-2 tw:[&_:is(input,select)]:text-body tw:[&_:is(input,select)]:text-copy tw:[&_:is(input,select):focus-visible]:outline-2 tw:[&_:is(input,select):focus-visible]:outline-offset-2 tw:[&_:is(input,select):focus-visible]:outline-focus">
      <label className="tw:font-semibold tw:text-copy" htmlFor={id}>
        {label}
      </label>
      {children}
      {error && (
        <span id={`${id}-error`} className="tw:text-caption tw:text-action-primary" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
