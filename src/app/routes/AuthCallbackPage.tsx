import { Link } from '@tanstack/react-router';
import { useAuthCallback } from '../../features/access/hooks/useAuthCallback';
import { recoveryLinkClass, RouteStatusPage } from './RouteStatusPage';

export function AuthCallbackPage() {
  const { unavailable } = useAuthCallback();
  return (
    <RouteStatusPage
      title={unavailable ? 'Não foi possível concluir o acesso' : 'Confirmando acesso…'}
      kind={unavailable ? 'error' : 'loading'}
      message={
        unavailable
          ? 'Solicite um novo código para entrar no Workspace.'
          : 'Aguarde enquanto verificamos o link de acesso.'
      }
    >
      {unavailable && (
        <Link
          to="/acesso"
          search={{ reason: 'signed_out', returnTo: '/cliente' }}
          replace
          className={recoveryLinkClass}
        >
          Solicitar novo código
        </Link>
      )}
    </RouteStatusPage>
  );
}
