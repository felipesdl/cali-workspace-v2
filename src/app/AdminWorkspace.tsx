import { phase4CatalogFromPath } from './phase4-navigation';
import { lazy, Suspense, type ReactNode } from 'react';
import {
  Outlet,
  useLocation,
  useMatches,
  useNavigate,
  useRouteContext,
} from '@tanstack/react-router';
import { adminPaths, adminSectionFromPath } from './navigation';
import { WorkspaceLayout } from './WorkspaceLayout';
import { AdminOverview } from '../features/companies/AdminOverview';
import { FeedbackState } from '../components/ds/feedback/FeedbackState';

const CompaniesPage = lazy(() =>
  import('../features/companies/CompaniesPage').then(({ CompaniesPage }) => ({
    default: CompaniesPage,
  })),
);
const AdminPreview = lazy(() => import('../AdminPreview'));

const adminReadTitles: Readonly<Record<string, string | undefined>> = {
  '/admin/mapa-people': 'Mapa de People',
  '/admin/satisfacao': 'Satisfação',
  '/admin/auditoria': 'Auditoria',
  [adminPaths.proposals]: 'Propostas',
  '/admin/equipe-cali': 'Equipe CALI',
};

const projectTitles: Readonly<Record<string, string | undefined>> = {
  '/admin/formularios': 'Formulários',
  '/admin/privacidade': 'Privacidade',
  [adminPaths.projects]: 'Projetos',
  [adminPaths.hours]: 'Horas',
};

export function AdminWorkspace() {
  const { access } = useRouteContext({ from: '__root__' });
  return access ? <ConnectedAdminWorkspace /> : <DemoAdminWorkspace />;
}

function ConnectedAdminWorkspace() {
  const pathname = useMatches({
    select: (matches) =>
      matches[matches.length - 1]?.pathname.replace(/\/$/, '') ?? adminPaths.overview,
  });
  const { team, disc, projectWorkspace, adminRead } = useRouteContext({ from: '__root__' });
  const outletTitle =
    (pathname === '/admin/minha-conta' && 'Minha conta') ||
    (team && pathname === adminPaths.people && 'Equipe') ||
    (disc && pathname === '/admin/perfil' && 'Perfil comportamental') ||
    (adminRead && adminReadTitles[pathname]) ||
    (projectWorkspace && (projectTitles[pathname] ?? phase4CatalogFromPath(pathname)?.title));

  let title = outletTitle || 'Empresas e acessos';
  let content: ReactNode = null;
  if (pathname === adminPaths.overview) {
    title = 'Visão executiva';
    content = <AdminOverview />;
  } else if (pathname === adminPaths.accounts) {
    content = (
      <Suspense fallback={<FeedbackState kind="loading">Carregando empresas…</FeedbackState>}>
        <CompaniesPage />
      </Suspense>
    );
  } else if (!outletTitle) {
    content = (
      <p>Esta área está em preparação. Acesse Empresas e acessos para acompanhar as contas.</p>
    );
  }

  return (
    <WorkspaceLayout title={title}>
      {content}
      <Outlet />
    </WorkspaceLayout>
  );
}

function DemoAdminWorkspace() {
  const navigate = useNavigate();
  const previewPath = useLocation({ select: (location) => location.pathname });
  return (
    <>
      <Suspense fallback={<FeedbackState kind="loading">Carregando demonstração…</FeedbackState>}>
        <AdminPreview
          section={adminSectionFromPath(previewPath)}
          onSectionChange={(section) => {
            if (section === 'accounts') {
              void navigate({ to: adminPaths.accounts, search: { q: '', status: 'all' } });
              return;
            }
            void navigate({ to: adminPaths[section] });
          }}
          onClient={() => void navigate({ to: '/cliente' })}
        />
      </Suspense>
      <Outlet />
    </>
  );
}
