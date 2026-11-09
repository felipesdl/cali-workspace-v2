import { type OwnProfileService } from '../api/modules/access/own-profile';
import type { PartnerPilot } from '../api/modules/partner/pilot';
import { type ProjectJournal } from '../api/modules/project-workspace/project-journal';
import { type AdminReadService } from '../api/modules/project-workspace/admin-read';
import { type DocumentOperations } from '../api/modules/project-workspace/documents';
import { type AgendaOperations } from '../api/modules/project-workspace/agenda';
import { type DomainOperations } from '../api/modules/project-workspace/domain-operations';
import {
  type HourOperations,
  type ProjectOperations,
} from '../api/modules/project-workspace/operations';
import { type ProjectWorkspace } from '../api/modules/project-workspace/service';
import { workspaceSearch } from '../api/modules/project-workspace/schemas';
import { z } from 'zod';
import { type DiscService } from '../api/modules/disc/service';
import { teamSearchSchema } from '../api/modules/team/schemas';
import { type TeamService } from '../api/modules/team/hosted';
import { type TeamMonthlyService } from '../api/modules/team/monthly';
import { type ReactElement } from 'react';
import { ClientOverview } from '../features/client-account/ClientOverview';
import { ClientCompanyPage } from '../features/client-account/ClientCompanyPage';
import { ClientTermsPage } from '../features/client-account/ClientTermsPage';
import { ClientModulePending } from '../features/client-account/ClientModulePending';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  redirect,
  type RouteComponent,
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
  partnerPilot?: PartnerPilot | null;
  companies: CompaniesService;
  ownProfile?: OwnProfileService | null;
  team?: TeamService | null;
  monthly?: TeamMonthlyService | null;
  disc?: DiscService | null;
  projectWorkspace?: ProjectWorkspace | null;
  projectJournal?: ProjectJournal | null;
  projectOperations?: ProjectOperations | null;
  hourOperations?: HourOperations | null;
  domainOperations?: DomainOperations | null;
  documentOperations?: DocumentOperations | null;
  agendaOperations?: AgendaOperations | null;
  adminRead?: AdminReadService | null;
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
function clientAccountChild<const Path extends string>(path: Path, component: RouteComponent) {
  return createRoute({
    getParentRoute: () => clientRoute,
    path,
    component,
    beforeLoad: ({ context }) => {
      if (!context.session) throw redirect({ to: '/cliente' });
    },
  });
}
const phase4CatalogPage = lazyRouteComponent(
  () => import('../features/project-workspace/WorkspaceRead'),
  'Phase4CatalogPage',
);
function clientCatalogChild<const Path extends string>(path: Path) {
  return createRoute({
    getParentRoute: () => clientRoute,
    path,
    validateSearch: workspaceSearch,
    component: phase4CatalogPage,
  });
}
function adminCatalogChild<const Path extends string>(path: Path) {
  return createRoute({
    getParentRoute: () => adminRoute,
    path,
    validateSearch: workspaceSearch,
    component: phase4CatalogPage,
  });
}
const clientChildren = [
  clientCatalogChild('frentes'),
  clientChild('/', ClientOverview),
  clientAccountChild('empresa', ClientCompanyPage),
  clientAccountChild(
    'minha-conta',
    lazyRouteComponent(() => import('../features/account/OwnProfilePage'), 'OwnProfilePage'),
  ),
  clientAccountChild('termos', ClientTermsPage),
  createRoute({
    getParentRoute: () => clientRoute,
    path: 'equipe',
    validateSearch: (search) => teamSearchSchema.parse(search),
    component: lazyRouteComponent(() => import('../features/team/TeamPage'), 'ClientTeamPage'),
  }),
  createRoute({
    getParentRoute: () => clientRoute,
    path: 'perfil',
    component: lazyRouteComponent(
      () => import('../features/disc/ClientDiscPage'),
      'ClientDiscPage',
    ),
  }),
  createRoute({
    getParentRoute: () => clientRoute,
    path: 'horas',
    validateSearch: workspaceSearch,
    component: lazyRouteComponent(
      () => import('../features/project-workspace/WorkspaceRead'),
      'ClientHoursPage',
    ),
  }),
  clientCatalogChild('cronograma'),
  clientCatalogChild('registros'),
  clientCatalogChild('documentos'),
  clientCatalogChild('relatorios'),
  createRoute({
    getParentRoute: () => clientRoute,
    path: 'propostas',
    component: lazyRouteComponent(
      () => import('../features/project-workspace/ClientCommercialPage'),
      'ClientCommercialPage',
    ),
  }),
  createRoute({
    getParentRoute: () => clientRoute,
    path: 'entregaveis',
    validateSearch: workspaceSearch,
    component: lazyRouteComponent(
      () => import('../features/project-workspace/WorkspaceRead'),
      'ClientProjectsPage',
    ),
  }),
  clientCatalogChild('avisos'),
] as const;
const adminChildren = [
  adminCatalogChild('frentes'),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'formularios',
    validateSearch: workspaceSearch,
    component: lazyRouteComponent(
      () => import('../features/project-workspace/WorkspaceRead'),
      'AdminFormsPage',
    ),
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'privacidade',
    validateSearch: workspaceSearch,
    component: lazyRouteComponent(
      () => import('../features/project-workspace/WorkspaceRead'),
      'AdminPrivacyPage',
    ),
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: '/',
    validateSearch: workspaceSearch.pick({ companyId: true }),
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'minha-conta',
    component: lazyRouteComponent(
      () => import('../features/account/OwnProfilePage'),
      'OwnProfilePage',
    ),
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'projetos',
    validateSearch: workspaceSearch,
    component: lazyRouteComponent(
      () => import('../features/project-workspace/WorkspaceRead'),
      'AdminProjectsPage',
    ),
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'horas',
    validateSearch: workspaceSearch,
    component: lazyRouteComponent(
      () => import('../features/project-workspace/WorkspaceRead'),
      'AdminHoursPage',
    ),
  }),
  adminCatalogChild('calendario'),
  adminCatalogChild('registros'),
  adminCatalogChild('documentos'),
  adminCatalogChild('relatorios'),
  adminCatalogChild('avisos'),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'equipe',
    validateSearch: (search) => teamSearchSchema.parse(search),
    component: lazyRouteComponent(() => import('../features/team/TeamPage'), 'AdminTeamPage'),
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'perfil',
    validateSearch: (search) => z.object({ campaign: z.uuid().optional() }).parse(search),
    component: lazyRouteComponent(() => import('./routes/AdminDiscRoute'), 'AdminDiscRoute'),
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'propostas',
    validateSearch: workspaceSearch,
    component: lazyRouteComponent(
      () => import('../features/project-workspace/WorkspaceRead'),
      'AdminCommercialPage',
    ),
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'auditoria',
    validateSearch: workspaceSearch,
    component: lazyRouteComponent(
      () => import('../features/project-workspace/WorkspaceRead'),
      'AdminAuditPage',
    ),
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'mapa-people',
    validateSearch: workspaceSearch,
    component: lazyRouteComponent(
      () => import('../features/project-workspace/WorkspaceRead'),
      'AdminMapaPage',
    ),
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'equipe-cali',
    validateSearch: workspaceSearch,
    component: lazyRouteComponent(
      () => import('../features/project-workspace/WorkspaceRead'),
      'AdminStaffRosterPage',
    ),
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'satisfacao',
    validateSearch: workspaceSearch,
    component: lazyRouteComponent(
      () => import('../features/project-workspace/WorkspaceRead'),
      'AdminSatisfactionPage',
    ),
  }),
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

const discRespondentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/disc/convite/$token',
  component: lazyRouteComponent(
    () => import('../features/disc/DiscRespondentPage'),
    'DiscRespondentPage',
  ),
});

const publicTextFormRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/f/$slug',
  component: lazyRouteComponent(
    () => import('../features/project-workspace/PublicTextForm'),
    'PublicTextFormPage',
  ),
});

const externalCommercialRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/proposta-externa',
  component: lazyRouteComponent(
    () => import('../features/project-workspace/ExternalCommercialPage'),
    'ExternalCommercialPage',
  ),
});

const partnerPilotRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/equipe',
  component: lazyRouteComponent(
    () => import('../features/partner/PartnerWorkspace'),
    'PartnerWorkspace',
  ),
});

const routeTree = rootRoute.addChildren([
  externalCommercialRoute,
  partnerPilotRoute,
  publicTextFormRoute,
  discRespondentRoute,
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
  services?: {
    access: HostedAccessApi;
    partnerPilot?: PartnerPilot | null;
    companies: CompaniesService;
    ownProfile?: OwnProfileService | null;
    team?: TeamService | null;
    monthly?: TeamMonthlyService | null;
    disc?: DiscService | null;
    projectWorkspace?: ProjectWorkspace | null;
    projectJournal?: ProjectJournal | null;
    projectOperations?: ProjectOperations | null;
    hourOperations?: HourOperations | null;
    domainOperations?: DomainOperations | null;
    documentOperations?: DocumentOperations | null;
    agendaOperations?: AgendaOperations | null;
    adminRead?: AdminReadService | null;
  },
) {
  return createRouter({
    routeTree,
    history,
    context: {
      queryClient,
      session,
      access: services?.access ?? null,
      partnerPilot: services?.partnerPilot ?? null,
      companies: services?.companies ?? companiesService,
      ownProfile: services?.ownProfile ?? null,
      team: services?.team ?? null,
      monthly: services?.monthly ?? null,
      disc: services?.disc ?? null,
      projectWorkspace: services?.projectWorkspace ?? null,
      projectJournal: services?.projectJournal ?? null,
      projectOperations: services?.projectOperations ?? null,
      hourOperations: services?.hourOperations ?? null,
      domainOperations: services?.domainOperations ?? null,
      documentOperations: services?.documentOperations ?? null,
      agendaOperations: services?.agendaOperations ?? null,
      adminRead: services?.adminRead ?? null,
    },
    defaultPreload: false,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
