import { type ReactNode } from 'react';

export function AccessActions({ children }: { children: ReactNode }) {
  return (
    <div className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] tw:gap-3">
      {children}
    </div>
  );
}
