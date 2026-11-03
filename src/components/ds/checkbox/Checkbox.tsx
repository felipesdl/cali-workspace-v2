import { type ComponentPropsWithoutRef, type ReactNode } from 'react';

type CheckboxProps = Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'children'> & {
  children: ReactNode;
};

export function Checkbox({ children, className = '', ...props }: CheckboxProps) {
  return (
    <label className="tw:my-4 tw:flex tw:items-start tw:gap-3">
      <input
        {...props}
        type="checkbox"
        className={`tw:shrink-0 tw:accent-action-primary tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-focus ${className}`}
      />
      {children}
    </label>
  );
}
