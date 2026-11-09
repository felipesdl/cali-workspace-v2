import { Link } from '@tanstack/react-router';
import { recoveryLinkClass, RouteStatusPage } from './RouteStatusPage';

export function NotFoundPage() {
  return (
    <RouteStatusPage
      title="Página não encontrada"
      kind="empty"
      message="Confira o endereço ou volte ao início do seu Workspace."
    >
      <Link to="/" replace className={recoveryLinkClass}>
        Voltar ao início
      </Link>
    </RouteStatusPage>
  );
}
