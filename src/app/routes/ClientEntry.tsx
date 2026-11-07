import { useRouteContext } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { ConnectedClientWorkspace } from '../ConnectedClientWorkspace';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';

const ClientWorkspace = lazy(() => import('../ClientWorkspace'));

export function ClientEntry() {
  const { session } = useRouteContext({ from: '__root__' });
  if (session) return <ConnectedClientWorkspace />;
  return (
    <Suspense fallback={<FeedbackState kind="loading">Carregando demonstração…</FeedbackState>}>
      <ClientWorkspace />
    </Suspense>
  );
}
