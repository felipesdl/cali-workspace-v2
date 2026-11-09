import { type ReactNode } from 'react';

type FieldProps = {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
};

export function Field({ id, label, error, children }: FieldProps) {
  return (
    <div className="tw:grid tw:min-w-0 tw:gap-2 tw:wrap-anywhere tw:[&_:is(input,select,textarea)]:box-border tw:[&_:is(input,select,textarea)]:min-h-control tw:[&_:is(input,select,textarea)]:w-full tw:[&_:is(input,select,textarea)]:min-w-0 tw:[&_:is(input,select,textarea)]:rounded-control tw:[&_:is(input,select,textarea)]:border tw:[&_:is(input,select,textarea)]:border-border-default tw:[&_:is(input,select,textarea)]:bg-panel tw:[&_:is(input,select,textarea)]:px-3 tw:[&_:is(input,select,textarea)]:py-2 tw:[&_:is(input,select,textarea)]:[font-family:inherit] tw:[&_:is(input,select,textarea)]:text-body tw:[&_:is(input,select,textarea)]:text-copy tw:[&_:is(input,select,textarea):focus-visible]:outline-2 tw:[&_:is(input,select,textarea):focus-visible]:outline-offset-2 tw:[&_:is(input,select,textarea):focus-visible]:outline-focus">
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
