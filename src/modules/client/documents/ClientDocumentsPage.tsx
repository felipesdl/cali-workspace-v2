import { useRouteContext } from '@tanstack/react-router';
import { WorkspaceCatalogPage } from '../../../components/workspace/WorkspaceCatalogPage';
import { useWorkspaceSession } from '../../../api/access/hooks/useWorkspaceSession';
import { workspaceRole } from '../../../api/access/schemas';
import { ClientDrive } from './components/ClientDrive';

export function ClientDocumentsPage() {
  const { clientDrive } = useRouteContext({ from: '__root__' });
  const snapshot = useWorkspaceSession();
  const profile =
    snapshot.phase === 'resolved' && snapshot.access.status === 'ready'
      ? snapshot.access.profile
      : null;
  return (
    <div className="tw:grid tw:gap-4">
      {clientDrive && profile?.role === workspaceRole.Client && profile.company_id && (
        <ClientDrive service={clientDrive} company={profile.company_id} actor={profile.id} />
      )}
      <WorkspaceCatalogPage module="documents" />
    </div>
  );
}
