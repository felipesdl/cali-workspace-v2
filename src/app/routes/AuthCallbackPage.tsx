import { useEffect, useState } from 'react';
import { useNavigate, useRouteContext, useSearch } from '@tanstack/react-router';

export function AuthCallbackPage() {
  const { access, session } = useRouteContext({ from: '__root__' });
  const { code } = useSearch({ from: '/auth/callback' });
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!access || !session) return;
    let active = true;
    void access
      .completeCallback(code)
      .then(async () => {
        await session.refresh();
        if (active)
          await navigate({
            to: '/acesso',
            search: { reason: 'signed_out', returnTo: '/cliente' },
            replace: true,
          });
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [access, code, navigate, session]);
  const unavailable = failed || !access || !session;
  return (
    <main className="tw:p-6 tw:text-body tw:text-copy" role={unavailable ? 'alert' : 'status'}>
      <h1 className="tw:text-section">
        {unavailable ? 'Não foi possível concluir o acesso' : 'Confirmando acesso…'}
      </h1>
      {unavailable && <a href="/acesso">Solicitar novo código</a>}
    </main>
  );
}
