import { type ReactElement } from 'react';
import { ClientOverview } from '../features/client-account/ClientOverview';
import { ClientCompanyPage } from '../features/client-account/ClientCompanyPage';
import { ClientTermsPage } from '../features/client-account/ClientTermsPage';
import { ClientModulePending } from '../features/client-account/ClientModulePending';
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
import { ClientEntry } from './routes/ClientEntry';
import { NotFoundPage } from './routes/NotFoundPage';
import { RouteErrorPage } from './routes/RouteErrorPage';
import { AccessGatePage } from './routes/AccessGatePage';
import { type SessionController } from './session/controller';
import { safeReturnPath, sessionGuard } from './session/guard';
import { type HostedAccessApi } from '../api/modules/access/api';
import { type CompaniesService } from '../api/modules/companies/service';
import { companiesService } from '../api/modules/companies/api';
import { parseAccessReason } from './session/access-reason';
import { AuthCallbackPage } from './routes/AuthCallbackPage';

const rootRoute = createRootRouteWithContext<{
  queryClient: QueryClient;
  session: SessionController | null;
  access: HostedAccessApi | null;
  companies: CompaniesService;
}>()({
  component: Outlet,
  notFoundComponent: NotFoundPage,
  errorComponent: RouteErrorPage,
});
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: async ({ context }) => {
    const state = await context.session?.resolve();
    if (state?.phase === 'resolved' && state.access.profile?.role === 'admin')
      throw redirect({ to: '/admin/clientes', search: { q: '', status: 'all' } });
    throw redirect({ to: '/cliente' });
  },
});
const clientRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cliente',
  beforeLoad: async ({ context, location }) => {
    if (!context.session) return; // Permitido somente na composição demonstrativa explícita.
    const reason = sessionGuard(await context.session.resolve(), 'client');
    if (reason !== 'allowed')
      throw redirect({
        to: '/acesso',
        search: { reason, returnTo: safeReturnPath(location.href) },
      });
  },
  component: ClientEntry,
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
function clientChild<const Path extends string>(
  path: Path,
  component: () => ReactElement = ClientModulePending,
) {
  return createRoute({ getParentRoute: () => clientRoute, path, component });
}
function clientAccountChild<const Path extends string>(path: Path, component: () => ReactElement) {
  return createRoute({
    getParentRoute: () => clientRoute,
    path,
    component,
    beforeLoad: ({ context }) => {
      if (!context.session) throw redirect({ to: '/cliente' });
    },
  });
}
function adminChild<const Path extends string>(path: Path) {
  return createRoute({ getParentRoute: () => adminRoute, path });
}
const clientChildren = [
  clientChild('/', ClientOverview),
  clientAccountChild('empresa', ClientCompanyPage),
  clientAccountChild('termos', ClientTermsPage),
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
    reason: parseAccessReason(typeof search.reason === 'string' ? search.reason : undefined),
    returnTo: safeReturnPath(typeof search.returnTo === 'string' ? search.returnTo : '/cliente'),
  }),
  component: AccessGatePage,
});

const callbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/callback',
  validateSearch: (search) => ({ code: typeof search.code === 'string' ? search.code : '' }),
  component: AuthCallbackPage,
});

const routeTree = rootRoute.addChildren([
  accessGateRoute,
  callbackRoute,
  indexRoute,
  clientRoute.addChildren(clientChildren),
  adminRoute.addChildren([...adminChildren, companiesRoute]),
]);

export function createAppRouter(
  history?: RouterHistory,
  queryClient = createQueryClient(),
  session: SessionController | null = null,
  services?: { access: HostedAccessApi; companies: CompaniesService },
) {
  return createRouter({
    routeTree,
    history,
    context: {
      queryClient,
      session,
      access: services?.access ?? null,
      companies: services?.companies ?? companiesService,
    },
    defaultPreload: false,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
