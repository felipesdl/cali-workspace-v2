import {
  AccessReason,
  type AccessReason as Reason,
  accessReasonMessages,
} from '../../../app/session/access-reason';
import { useSearch, useRouteContext } from '@tanstack/react-router';
import { FeedbackMessage } from '../../../components/ds/feedback/FeedbackMessage';
import { AccessFlow } from './components/AccessFlow';
import { AccessShell } from './components/AccessShell';

export function AccessGatePage() {
  const { reason, returnTo } = useSearch({ from: '/acesso' });
  return <AccessPage reason={reason} returnTo={returnTo} />;
}

export function LoginPage() {
  const { returnTo } = useSearch({ from: '/login' });
  return <AccessPage reason={AccessReason.SignedOut} returnTo={returnTo ?? '/cliente'} />;
}

function AccessPage({ reason, returnTo }: { reason: Reason; returnTo: string }) {
  const { access, session } = useRouteContext({ from: '__root__' });
  if (access && session) return <AccessFlow api={access} session={session} returnTo={returnTo} />;
  const message = accessReasonMessages[reason];
  return (
    <AccessShell>
      <h1 id="access-title" className="tw:mb-4">
        Acesso indisponível
      </h1>
      <FeedbackMessage tone="error">{message}</FeedbackMessage>
    </AccessShell>
  );
}
