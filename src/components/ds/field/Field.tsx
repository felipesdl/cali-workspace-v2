import { type ReactNode } from 'react';
import { FeedbackMessage } from '../feedback/FeedbackMessage';

type FieldProps = {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
};

export function Field({ id, label, error, children }: FieldProps) {
  return (
    <div className="tw:grid tw:min-w-0 tw:gap-2 tw:wrap-anywhere">
      <label className="tw:font-semibold tw:text-copy" htmlFor={id}>
        {label}
      </label>
      {children}
      {error && (
        <FeedbackMessage id={`${id}-error`} tone="error" className="tw:mt-1">
          {error}
        </FeedbackMessage>
      )}
    </div>
  );
}
