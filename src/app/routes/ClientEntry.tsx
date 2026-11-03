import { useRouteContext } from '@tanstack/react-router';
import ClientWorkspace from '../ClientWorkspace';
import { ConnectedClientWorkspace } from '../ConnectedClientWorkspace';

export function ClientEntry() {
  const { session } = useRouteContext({ from: '__root__' });
  return session ? <ConnectedClientWorkspace /> : <ClientWorkspace />;
}
