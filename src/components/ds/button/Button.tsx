import { type ButtonHTMLAttributes } from 'react';
import { type UiVariant } from '../variants';

const variantClasses = {
  primary: 'tw:bg-action-primary tw:text-panel',
  secondary: 'tw:bg-panel tw:text-action-primary',
} satisfies Record<UiVariant, string>;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: UiVariant;
  pending?: boolean;
};

export function Button({
  variant = 'primary',
  pending = false,
  disabled,
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`tw:box-border tw:inline-flex tw:min-h-control tw:cursor-pointer tw:items-center tw:justify-center tw:gap-2 tw:rounded-control tw:border tw:border-action-primary tw:px-4 tw:py-2 tw:text-body tw:focus-visible:outline-2 tw:focus-visible:outline-offset-3 tw:focus-visible:outline-focus tw:disabled:cursor-not-allowed tw:disabled:opacity-65 ${variantClasses[variant]} ${className}`}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
    />
  );
}
