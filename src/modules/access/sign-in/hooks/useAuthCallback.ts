import { useEffect, useState } from 'react';
import { useNavigate, useRouteContext, useSearch } from '@tanstack/react-router';

export function useAuthCallback() {
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
  return { unavailable };
}
