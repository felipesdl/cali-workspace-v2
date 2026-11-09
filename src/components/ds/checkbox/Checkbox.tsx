import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';

type CheckboxInputProps = Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'children'>;
type CheckboxProps = CheckboxInputProps & {
  children: ReactNode;
};

export const CheckboxInput = forwardRef<HTMLInputElement, CheckboxInputProps>(
  function CheckboxInput({ className = '', ...props }, ref) {
    return (
      <input
        {...props}
        ref={ref}
        type="checkbox"
        className={`tw:shrink-0 tw:accent-action-primary tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-focus ${className}`}
      />
    );
  },
);

export function Checkbox({ children, ...props }: CheckboxProps) {
  return (
    <label className="tw:my-4 tw:flex tw:items-start tw:gap-3">
      <CheckboxInput {...props} />
      {children}
    </label>
  );
}
