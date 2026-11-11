import { RouteStatusPage, WorkspaceRecoveryLink } from './RouteStatusPage';

export function NotFoundPage() {
  return (
    <RouteStatusPage
      title="Página não encontrada"
      kind="empty"
      message="Confira o endereço ou volte ao início do seu Workspace."
    >
      <WorkspaceRecoveryLink />
    </RouteStatusPage>
  );
}
