import { useRouteContext } from '@tanstack/react-router';
import ClientWorkspace from '../ClientWorkspace';
import { HostedClientWorkspace } from '../WorkspaceLayout';

export function ClientEntry() {
  const { access } = useRouteContext({ from: '__root__' });
  return access ? <HostedClientWorkspace /> : <ClientWorkspace />;
}
