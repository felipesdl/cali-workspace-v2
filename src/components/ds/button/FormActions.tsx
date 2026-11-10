import { type ReactNode } from 'react';

export function FormActions({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`tw:grid tw:min-w-0 tw:grid-cols-[repeat(auto-fit,minmax(min(100%,6.5rem),1fr))] tw:gap-3 tw:[&>button]:min-w-0 tw:[&>button]:text-center tw:[&>button]:wrap-anywhere ${className}`}
    >
      {children}
    </div>
  );
}
