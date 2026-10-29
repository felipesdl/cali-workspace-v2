import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { type createAppRouter } from './router';
import { useEffect } from 'react';

export function App({ router }: { router: ReturnType<typeof createAppRouter> }) {
  useEffect(() => {
    return router.options.context.session?.subscribe(() => {
      void router.invalidate();
    });
  }, [router]);
  return (
    <QueryClientProvider client={router.options.context.queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
