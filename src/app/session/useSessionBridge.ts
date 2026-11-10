import { useEffect } from 'react';
import { type createAppRouter } from '../router';

export function useSessionBridge(router: ReturnType<typeof createAppRouter>) {
  useEffect(() => {
    const { session, access } = router.options.context;
    const stopRouter = session?.subscribe(() => {
      void router.invalidate();
    });
    const stopAuth = access?.subscribe((invalidate) => {
      if (invalidate) void session?.refresh();
      else void session?.revalidate();
    });
    return () => {
      stopRouter?.();
      stopAuth?.();
    };
  }, [router]);
}
