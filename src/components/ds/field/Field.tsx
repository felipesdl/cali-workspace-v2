import { type ReactNode } from 'react';
import './field.css';

type FieldProps = {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
};

export function Field({ id, label, error, children }: FieldProps) {
  return (
    <div className="ds-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && (
        <span id={`${id}-error`} className="ds-field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
