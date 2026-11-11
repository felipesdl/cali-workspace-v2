import { LegalPage } from '../modules/public/legal/LegalPage';
import { type ClientDriveService } from '../api/client/drive';
import { type PublicFormsService } from '../api/shared/forms/public';
import { type FormLifecycle } from '../api/admin/forms/lifecycle';
import { type AdminPortfolioService } from '../api/admin/workspace/admin-portfolio';
import { type NotificationsService } from '../api/shared/notifications/schemas';
import { type OwnProfileService } from '../api/access/own-profile';
import { partnerModule, type PartnerModule, type PartnerPilot } from '../api/partner/pilot';
import { type ProjectJournal } from '../api/shared/workspace/project-journal';
import { type AdminReadService } from '../api/admin/workspace/admin-read';
import { type DocumentOperations } from '../api/shared/workspace/documents';
import { type AgendaOperations } from '../api/shared/workspace/agenda';
import { type DomainOperations } from '../api/shared/workspace/domain-operations';
import { type HourOperations, type ProjectOperations } from '../api/shared/workspace/operations';
import { type ProjectWorkspace } from '../api/shared/workspace/service';
import { workspaceSearch } from '../api/shared/workspace/schemas';
import { z } from 'zod';
import { type DiscService } from '../api/shared/disc/service';
import { teamSearchSchema } from '../api/shared/team/schemas';
import { type TeamService } from '../api/shared/team/hosted';
import { type TeamMonthlyService } from '../api/shared/team/monthly';
import { type ReactElement } from 'react';
import { ClientOverview } from '../modules/client/home/ClientOverview';
import { ClientFaqPage } from '../modules/client/help/ClientFaqPage';
import { ClientCompanyPage } from '../modules/client/company/ClientCompanyPage';
import { ClientTermsPage } from '../modules/client/terms/ClientTermsPage';
import { ClientModulePending } from '../components/workspace/ClientModulePending';
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
import { companySearchSchema } from '../api/admin/companies/schemas';
import { createQueryClient } from '../api/query-client';
import { AdminWorkspace } from './AdminWorkspace';
import { AdminOverview } from '../modules/admin/overview/AdminOverview';
import { ClientWorkspace } from './ClientWorkspace';
import { NotFoundPage } from './routes/NotFoundPage';
import { RouteErrorPage } from './routes/RouteErrorPage';
import { AccessGatePage, LoginPage } from '../modules/access/sign-in/AccessGatePage';
import { type SessionController } from './session/controller';
import { safeReturnPath, sessionGuard } from './session/guard';
import { type HostedAccessApi } from '../api/access/api';
import { workspaceRole } from '../api/access/schemas';
import { type CompaniesService } from '../api/admin/companies/service';
import { companiesService } from '../api/admin/companies/api';
import { parseAccessReason } from './session/access-reason';
import { AuthCallbackPage } from '../modules/access/sign-in/AuthCallbackPage';

const rootRoute = createRootRouteWithContext<{
  queryClient: QueryClient;
  session: SessionController | null;
  access: HostedAccessApi | null;
  partnerPilot?: PartnerPilot | null;
  companies: CompaniesService;
  ownProfile?: OwnProfileService | null;
  notifications?: NotificationsService | null;
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
  adminPortfolio?: AdminPortfolioService | null;
  clientDrive?: ClientDriveService | null;
  publicForms?: PublicFormsService | null;
  formLifecycle?: FormLifecycle | null;
}>()({
  component: Outlet,
  notFoundComponent: NotFoundPage,
  errorComponent: RouteErrorPage,
});
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: lazyRouteComponent(
    () => import('../modules/public/landing/LandingPage'),
    'LandingPage',
  ),
});
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (search): { returnTo?: string } => ({
    returnTo: typeof search.returnTo === 'string' ? safeReturnPath(search.returnTo) : undefined,
  }),
  component: LoginPage,
});
function legalRoute<const Path extends string>(path: Path, kind: 'privacy' | 'terms' | 'site') {
  return createRoute({
    getParentRoute: () => rootRoute,
    path,
    component: () => <LegalPage kind={kind} />,
  });
}
const legalRoutes = [
  legalRoute('/privacidade', 'privacy'),
  legalRoute('/termos', 'terms'),
  legalRoute('/politica-do-site', 'site'),
] as const;
const clientRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cliente',
  beforeLoad: async ({ context, location }) => {
    if (!context.session) return; // Permitido somente na composição demonstrativa explícita.
    const reason = sessionGuard(await context.session.resolve(), workspaceRole.Client);
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
    const reason = sessionGuard(await context.session.resolve(), workspaceRole.Admin);
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
function workspaceCatalogChild<
  Parent extends typeof adminRoute | typeof clientRoute,
  const Path extends string,
>(parent: Parent, path: Path, component: RouteComponent) {
  return createRoute({
    getParentRoute: () => parent,
    path,
    validateSearch: workspaceSearch,
    component,
  });
}
const clientChildren = [
  createRoute({
    getParentRoute: () => clientRoute,
    path: 'perfil',
    beforeLoad: () => {
      throw redirect({ to: '/cliente/perfil-comportamental', replace: true });
    },
  }),
  workspaceCatalogChild(
    clientRoute,
    'frentes',
    lazyRouteComponent(
      () => import('../modules/client/fronts/ClientFrontsPage'),
      'ClientFrontsPage',
    ),
  ),
  clientChild('/', ClientOverview),
  clientChild('ajuda', ClientFaqPage),
  clientAccountChild('empresa', ClientCompanyPage),
  clientAccountChild(
    'minha-conta',
    lazyRouteComponent(
      () => import('../modules/client/account/ClientOwnProfilePage'),
      'ClientOwnProfilePage',
    ),
  ),
  clientAccountChild('termos', ClientTermsPage),
  createRoute({
    getParentRoute: () => clientRoute,
    path: 'equipe',
    validateSearch: (search) => teamSearchSchema.parse(search),
    component: lazyRouteComponent(
      () => import('../modules/client/team/ClientTeamPage'),
      'ClientTeamPage',
    ),
  }),
  createRoute({
    getParentRoute: () => clientRoute,
    path: 'perfil-comportamental',
    component: lazyRouteComponent(
      () => import('../modules/client/disc/ClientDiscPage'),
      'ClientDiscPage',
    ),
  }),
  createRoute({
    getParentRoute: () => clientRoute,
    path: 'horas',
    validateSearch: workspaceSearch,
    component: lazyRouteComponent(
      () => import('../modules/client/hours/ClientHoursPage'),
      'ClientHoursPage',
    ),
  }),
  workspaceCatalogChild(
    clientRoute,
    'cronograma',
    lazyRouteComponent(
      () => import('../modules/client/agenda/ClientAgendaPage'),
      'ClientAgendaPage',
    ),
  ),
  workspaceCatalogChild(
    clientRoute,
    'registros',
    lazyRouteComponent(
      () => import('../modules/client/records/ClientRecordsPage'),
      'ClientRecordsPage',
    ),
  ),
  workspaceCatalogChild(
    clientRoute,
    'documentos',
    lazyRouteComponent(
      () => import('../modules/client/documents/ClientDocumentsPage'),
      'ClientDocumentsPage',
    ),
  ),
  workspaceCatalogChild(
    clientRoute,
    'relatorios',
    lazyRouteComponent(
      () => import('../modules/client/reports/ClientReportsPage'),
      'ClientReportsPage',
    ),
  ),
  createRoute({
    getParentRoute: () => clientRoute,
    path: 'propostas',
    component: lazyRouteComponent(
      () => import('../modules/client/proposals/ClientCommercialPage'),
      'ClientCommercialPage',
    ),
  }),
  createRoute({
    getParentRoute: () => clientRoute,
    path: 'entregaveis',
    validateSearch: workspaceSearch,
    component: lazyRouteComponent(
      () => import('../modules/client/projects/ClientProjectsPage'),
      'ClientProjectsPage',
    ),
  }),
  workspaceCatalogChild(
    clientRoute,
    'avisos',
    lazyRouteComponent(
      () => import('../modules/client/notices/ClientNoticesPage'),
      'ClientNoticesPage',
    ),
  ),
] as const;
const adminChildren = [
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'perfil',
    beforeLoad: ({ search }) => {
      throw redirect({
        to: '/admin/perfil-comportamental',
        search: z.object({ campaign: z.uuid().optional().catch(undefined) }).parse(search),
        replace: true,
      });
    },
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'mapa-people',
    beforeLoad: ({ search }) => {
      throw redirect({
        to: '/admin/mapa-de-people',
        search: workspaceSearch.parse(search),
        replace: true,
      });
    },
  }),
  workspaceCatalogChild(
    adminRoute,
    'frentes',
    lazyRouteComponent(() => import('../modules/admin/fronts/AdminFrontsPage'), 'AdminFrontsPage'),
  ),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'formularios',
    validateSearch: workspaceSearch,
    component: lazyRouteComponent(
      () => import('../modules/admin/forms/AdminFormsPage'),
      'AdminFormsPage',
    ),
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'privacidade',
    validateSearch: workspaceSearch,
    component: lazyRouteComponent(
      () => import('../modules/admin/privacy/AdminPrivacyPage'),
      'AdminPrivacyPage',
    ),
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: '/',
    validateSearch: workspaceSearch.pick({ companyId: true, month: true }),
    component: AdminOverview,
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'minha-conta',
    component: lazyRouteComponent(
      () => import('../modules/admin/account/AdminOwnProfilePage'),
      'AdminOwnProfilePage',
    ),
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'projetos',
    validateSearch: workspaceSearch,
    component: lazyRouteComponent(
      () => import('../modules/admin/projects/AdminProjectsPage'),
      'AdminProjectsPage',
    ),
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'horas',
    validateSearch: workspaceSearch,
    component: lazyRouteComponent(
      () => import('../modules/admin/hours/AdminHoursPage'),
      'AdminHoursPage',
    ),
  }),
  workspaceCatalogChild(
    adminRoute,
    'calendario',
    lazyRouteComponent(() => import('../modules/admin/agenda/AdminAgendaPage'), 'AdminAgendaPage'),
  ),
  workspaceCatalogChild(
    adminRoute,
    'registros',
    lazyRouteComponent(
      () => import('../modules/admin/records/AdminRecordsPage'),
      'AdminRecordsPage',
    ),
  ),
  workspaceCatalogChild(
    adminRoute,
    'documentos',
    lazyRouteComponent(
      () => import('../modules/admin/documents/AdminDocumentsPage'),
      'AdminDocumentsPage',
    ),
  ),
  workspaceCatalogChild(
    adminRoute,
    'relatorios',
    lazyRouteComponent(
      () => import('../modules/admin/reports/AdminReportsPage'),
      'AdminReportsPage',
    ),
  ),
  workspaceCatalogChild(
    adminRoute,
    'avisos',
    lazyRouteComponent(
      () => import('../modules/admin/notices/AdminNoticesPage'),
      'AdminNoticesPage',
    ),
  ),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'equipe',
    validateSearch: (search) => teamSearchSchema.parse(search),
    component: lazyRouteComponent(
      () => import('../modules/admin/team/AdminTeamPage'),
      'AdminTeamPage',
    ),
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'perfil-comportamental',
    validateSearch: (search) => z.object({ campaign: z.uuid().optional() }).parse(search),
    component: lazyRouteComponent(
      () => import('../modules/admin/disc/AdminDiscRoute'),
      'AdminDiscRoute',
    ),
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'propostas',
    validateSearch: workspaceSearch,
    component: lazyRouteComponent(
      () => import('../modules/admin/proposals/AdminCommercialPage'),
      'AdminCommercialPage',
    ),
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'auditoria',
    validateSearch: workspaceSearch,
    component: lazyRouteComponent(
      () => import('../modules/admin/audit/AdminAuditPage'),
      'AdminAuditPage',
    ),
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'mapa-de-people',
    validateSearch: workspaceSearch,
    component: lazyRouteComponent(
      () => import('../modules/admin/people-map/AdminMapaPage'),
      'AdminMapaPage',
    ),
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'equipe-cali',
    validateSearch: workspaceSearch,
    component: lazyRouteComponent(
      () => import('../modules/admin/staff/AdminStaffRosterPage'),
      'AdminStaffRosterPage',
    ),
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'satisfacao',
    validateSearch: workspaceSearch,
    component: lazyRouteComponent(
      () => import('../modules/admin/satisfaction/AdminSatisfactionPage'),
      'AdminSatisfactionPage',
    ),
  }),
] as const;

export const companiesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'clientes',
  validateSearch: (search) => companySearchSchema.parse(search),
  component: lazyRouteComponent(
    () => import('../modules/admin/companies/CompaniesPage'),
    'CompaniesPage',
  ),
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
    () => import('../modules/public/disc/DiscRespondentPage'),
    'DiscRespondentPage',
  ),
});

const publicTextFormRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/f/$slug',
  component: lazyRouteComponent(
    () => import('../modules/public/forms/PublicTextForm'),
    'PublicTextFormPage',
  ),
});

const externalCommercialRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/proposta-externa',
  component: lazyRouteComponent(
    () => import('../modules/public/proposals/ExternalCommercialPage'),
    'ExternalCommercialPage',
  ),
});

const partnerPilotRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/equipe',
  validateSearch: z.object({ modulo: partnerModule.optional().catch(undefined) }),
  component: lazyRouteComponent(
    () => import('../modules/partner/home/PartnerWorkspace'),
    'PartnerWorkspace',
  ),
});

function partnerModuleRoute<const Path extends `/equipe/${string}`>(
  path: Path,
  modulo: PartnerModule,
) {
  return createRoute({
    getParentRoute: () => rootRoute,
    path,
    beforeLoad: () => {
      throw redirect({ to: '/equipe', search: { modulo }, replace: true });
    },
  });
}

const partnerModuleRoutes = [
  partnerModuleRoute('/equipe/projetos', 'projects'),
  partnerModuleRoute('/equipe/ocorrencias', 'records'),
  partnerModuleRoute('/equipe/horas', 'hours'),
  partnerModuleRoute('/equipe/calendario', 'calendar'),
  partnerModuleRoute('/equipe/documentos', 'documents'),
  partnerModuleRoute('/equipe/relatorios', 'reports'),
  partnerModuleRoute('/equipe/avisos', 'notices'),
  partnerModuleRoute('/equipe/pessoas', 'team'),
] as const;

const driveCallback = createRoute({
  getParentRoute: () => rootRoute,
  path: '/oauth/google/callback',
  validateSearch: z.object({
    code: z.string().min(1).max(4000).optional().catch(undefined),
    state: z.string().min(1).max(4000).optional().catch(undefined),
    error: z.string().min(1).max(4000).optional().catch(undefined),
  }),
  component: lazyRouteComponent(
    () => import('../modules/client/documents/GoogleDriveCallback'),
    'GoogleDriveCallback',
  ),
});

const routeTree = rootRoute.addChildren([
  driveCallback,
  externalCommercialRoute,
  partnerPilotRoute,
  ...partnerModuleRoutes,
  publicTextFormRoute,
  discRespondentRoute,
  accessGateRoute,
  callbackRoute,
  indexRoute,
  loginRoute,
  ...legalRoutes,
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
    notifications?: NotificationsService | null;
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
    adminPortfolio?: AdminPortfolioService | null;
    clientDrive?: ClientDriveService | null;
    publicForms?: PublicFormsService | null;
    formLifecycle?: FormLifecycle | null;
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
      notifications: services?.notifications ?? null,
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
      adminPortfolio: services?.adminPortfolio ?? null,
      clientDrive: services?.clientDrive ?? null,
      publicForms: services?.publicForms ?? null,
      formLifecycle: services?.formLifecycle ?? null,
    },
    defaultPreload: false,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
