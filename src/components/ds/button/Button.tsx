import { type ButtonHTMLAttributes } from 'react';
import { type UiVariant } from '../variants';
import './button.css';

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
      className={`ds-button ds-button--${variant} ${className}`}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
    />
  );
}
