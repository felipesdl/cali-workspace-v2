import { type ReactNode } from 'react';
import { Button } from '../button/Button';
import { type UiVariant } from '../variants';

type FeedbackStateProps = {
  kind: 'loading' | 'error' | 'empty';
  children: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  retryVariant?: UiVariant;
};

// A mensagem e a decisão de repetir a operação pertencem ao consumidor.
export function FeedbackState({
  kind,
  children,
  onRetry,
  retryLabel = 'Tentar novamente',
  retryVariant = 'primary',
}: FeedbackStateProps) {
  const roles = { loading: 'status', error: 'alert', empty: undefined } as const;
  return (
    <div className="tw:min-w-0 tw:wrap-anywhere" role={roles[kind]}>
      <p>{children}</p>
      {onRetry && (
        <Button variant={retryVariant} onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
