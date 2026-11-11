import { type ComponentPropsWithoutRef } from 'react';

export function Panel({ className = '', ...props }: ComponentPropsWithoutRef<'section'>) {
  return (
    <section
      {...props}
      className={`tw:box-border tw:min-w-0 tw:rounded-panel tw:border tw:border-border-default tw:bg-panel tw:p-4 ${className}`}
    />
  );
}
