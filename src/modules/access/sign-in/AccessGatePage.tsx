import { accessReasonMessages } from '../../../app/session/access-reason';
import { useSearch, useRouteContext } from '@tanstack/react-router';
import { FeedbackMessage } from '../../../components/ds/feedback/FeedbackMessage';
import { AccessFlow } from './components/AccessFlow';

export function AccessGatePage() {
  const { reason, returnTo } = useSearch({ from: '/acesso' });
  const { access, session } = useRouteContext({ from: '__root__' });
  if (access && session) return <AccessFlow api={access} session={session} returnTo={returnTo} />;
  const message = accessReasonMessages[reason];
  return (
    <main className="tw:m-6 tw:grid tw:gap-3 tw:text-body tw:text-copy">
      <h1 className="tw:text-section tw:font-bold">Acesso indisponível</h1>
      <FeedbackMessage tone="error">{message}</FeedbackMessage>
    </main>
  );
}
