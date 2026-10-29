import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  type RouterHistory,
} from '@tanstack/react-router';
import { type QueryClient } from '@tanstack/react-query';
import { companySearchSchema } from '../api/modules/companies/schemas';
import { createQueryClient } from '../api/query-client';
import { AdminWorkspace } from './AdminWorkspace';
import ClientWorkspace from './ClientWorkspace';
import { NotFoundPage } from './routes/NotFoundPage';
import { RouteErrorPage } from './routes/RouteErrorPage';
import { AccessGatePage } from './routes/AccessGatePage';
import { type SessionController } from './session/controller';
import { safeReturnPath, sessionGuard } from './session/guard';

const rootRoute = createRootRouteWithContext<{
  queryClient: QueryClient;
  session: SessionController | null;
}>()({
  component: Outlet,
  notFoundComponent: NotFoundPage,
  errorComponent: RouteErrorPage,
});
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/cliente' });
  },
});
const clientRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cliente',
  beforeLoad: async ({ context, location }) => {
    if (!context.session) return; // Modo demonstrativo; configuração real continua proibida no bootstrap.
    const reason = sessionGuard(await context.session.resolve(), 'client');
    if (reason !== 'allowed')
      throw redirect({
        to: '/acesso',
        search: { reason, returnTo: safeReturnPath(location.href) },
      });
  },
  component: ClientWorkspace,
});
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  beforeLoad: async ({ context, location }) => {
    if (!context.session) return;
    const reason = sessionGuard(await context.session.resolve(), 'admin');
    if (reason !== 'allowed')
      throw redirect({
        to: '/acesso',
        search: { reason, returnTo: safeReturnPath(location.href) },
      });
  },
  component: AdminWorkspace,
});

// Ponte para composições existentes. O layout resolve a seção; filhos não criam páginas vazias.
function clientChild<const Path extends string>(path: Path) {
  return createRoute({ getParentRoute: () => clientRoute, path });
}
function adminChild<const Path extends string>(path: Path) {
  return createRoute({ getParentRoute: () => adminRoute, path });
}
const clientChildren = [
  clientChild('/'),
  clientChild('equipe'),
  clientChild('horas'),
  clientChild('cronograma'),
  clientChild('registros'),
  clientChild('documentos'),
  clientChild('relatorios'),
  clientChild('entregaveis'),
  clientChild('avisos'),
] as const;
const adminChildren = [
  adminChild('/'),
  adminChild('projetos'),
  adminChild('horas'),
  adminChild('calendario'),
  adminChild('registros'),
  adminChild('documentos'),
  adminChild('relatorios'),
  adminChild('avisos'),
  adminChild('equipe'),
  adminChild('propostas'),
] as const;

export const companiesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'clientes',
  validateSearch: (search) => companySearchSchema.parse(search),
});

const accessGateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/acesso',
  validateSearch: (search) => ({
    reason: typeof search.reason === 'string' ? search.reason : 'unavailable',
    returnTo: safeReturnPath(typeof search.returnTo === 'string' ? search.returnTo : '/cliente'),
  }),
  component: AccessGatePage,
});

const routeTree = rootRoute.addChildren([
  accessGateRoute,
  indexRoute,
  clientRoute.addChildren(clientChildren),
  adminRoute.addChildren([...adminChildren, companiesRoute]),
]);

export function createAppRouter(
  history?: RouterHistory,
  queryClient = createQueryClient(),
  session: SessionController | null = null,
) {
  return createRouter({
    routeTree,
    history,
    context: { queryClient, session },
    defaultPreload: false,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
