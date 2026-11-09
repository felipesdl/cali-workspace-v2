import { type ReactNode } from 'react';
import { Button } from '../button/Button';
import { type UiVariant } from '../variants';
import { FeedbackMessage } from './FeedbackMessage';

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
  return (
    <div className="tw:grid tw:min-w-0 tw:justify-items-start tw:gap-3 tw:wrap-anywhere">
      {kind === 'error' ? (
        <FeedbackMessage tone="error" className="tw:justify-self-stretch">
          {children}
        </FeedbackMessage>
      ) : (
        <p className="tw:m-0" role={kind === 'loading' ? 'status' : undefined}>
          {children}
        </p>
      )}
      {onRetry && (
        <Button variant={retryVariant} onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
