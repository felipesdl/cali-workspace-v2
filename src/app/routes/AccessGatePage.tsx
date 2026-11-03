import { accessReasonMessages } from '../session/access-reason';
import { useSearch, useRouteContext } from '@tanstack/react-router';
import { AccessFlow } from '../../features/access/AccessFlow';

export function AccessGatePage() {
  const { reason, returnTo } = useSearch({ from: '/acesso' });
  const { access, session } = useRouteContext({ from: '__root__' });
  if (access && session) return <AccessFlow api={access} session={session} returnTo={returnTo} />;
  const message = accessReasonMessages[reason];
  return (
    <main className="tw:m-6 tw:text-body tw:text-copy" role="alert">
      <h1 className="tw:text-section tw:font-bold">Acesso indisponível</h1>
      <p>{message}</p>
    </main>
  );
}
