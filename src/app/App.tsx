import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { type createAppRouter } from './router';
import { useEffect } from 'react';

export function App({ router }: { router: ReturnType<typeof createAppRouter> }) {
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
  return (
    <QueryClientProvider client={router.options.context.queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
