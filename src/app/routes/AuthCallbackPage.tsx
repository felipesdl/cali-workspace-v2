import { useAuthCallback } from '../../features/access/hooks/useAuthCallback';

export function AuthCallbackPage() {
  const { unavailable } = useAuthCallback();
  return (
    <main className="tw:p-6 tw:text-body tw:text-copy" role={unavailable ? 'alert' : 'status'}>
      <h1 className="tw:text-section">
        {unavailable ? 'Não foi possível concluir o acesso' : 'Confirmando acesso…'}
      </h1>
      {unavailable && <a href="/acesso">Solicitar novo código</a>}
    </main>
  );
}
