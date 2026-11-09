import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import './select.css';

const control =
  'tw:box-border tw:min-h-control tw:max-w-full tw:min-w-0 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:px-3 tw:py-2 tw:[font-family:inherit] tw:text-body tw:text-copy tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-focus tw:aria-invalid:border-action-primary tw:disabled:cursor-not-allowed tw:disabled:opacity-65';

export const Input = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<'input'>>(function Input(
  { className = '', ...props },
  ref,
) {
  return <input {...props} ref={ref} className={`${control} ${className}`} />;
});

export const Select = forwardRef<HTMLSelectElement, ComponentPropsWithoutRef<'select'>>(
  function Select({ className = '', ...props }, ref) {
    return <select {...props} ref={ref} className={`cali-select ${control} ${className}`} />;
  },
);

export const TextArea = forwardRef<HTMLTextAreaElement, ComponentPropsWithoutRef<'textarea'>>(
  function TextArea({ className = '', ...props }, ref) {
    return <textarea {...props} ref={ref} className={`${control} tw:resize-y ${className}`} />;
  },
);
