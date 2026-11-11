import { RouteStatusPage, WorkspaceRecoveryLink } from './RouteStatusPage';

export function RouteErrorPage() {
  return (
    <RouteStatusPage
      title="Não foi possível abrir esta página"
      kind="error"
      message="Volte ao início do Workspace para continuar."
    >
      <WorkspaceRecoveryLink />
    </RouteStatusPage>
  );
}
