import { Link } from '@tanstack/react-router';
import { recoveryLinkClass, RouteStatusPage } from './RouteStatusPage';

export function RouteErrorPage() {
  return (
    <RouteStatusPage
      title="Não foi possível abrir esta página"
      kind="error"
      message="Volte ao início do Workspace para continuar."
    >
      <Link to="/" replace className={recoveryLinkClass}>
        Voltar ao início
      </Link>
    </RouteStatusPage>
  );
}
