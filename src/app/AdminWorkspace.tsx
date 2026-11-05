import { lazy, Suspense } from 'react';
import { Outlet, useLocation, useNavigate, useRouteContext } from '@tanstack/react-router';
import AdminPreview from '../AdminPreview';
import { adminPaths, adminSectionFromPath } from './navigation';
import { WorkspaceLayout } from './WorkspaceLayout';
import { FeedbackState } from '../components/ds/feedback/FeedbackState';

const CompaniesPage = lazy(() =>
  import('../features/companies/CompaniesPage').then(({ CompaniesPage }) => ({
    default: CompaniesPage,
  })),
);

export function AdminWorkspace() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
  const { access, team } = useRouteContext({ from: '__root__' });
  const showTeam = Boolean(team && pathname === adminPaths.people);
  if (access)
    return (
      <WorkspaceLayout title={showTeam ? 'Equipe' : 'Empresas e acessos'}>
        {showTeam ? null : pathname === '/admin/clientes' ? (
          <Suspense fallback={<FeedbackState kind="loading">Carregando empresas…</FeedbackState>}>
            <CompaniesPage />
          </Suspense>
        ) : (
          <p>Esta área está em preparação. Acesse Empresas e acessos para acompanhar as contas.</p>
        )}
        <Outlet />
      </WorkspaceLayout>
    );
  return (
    <>
      <AdminPreview
        section={adminSectionFromPath(pathname)}
        onSectionChange={(section) => {
          if (section === 'accounts') {
            void navigate({ to: '/admin/clientes', search: { q: '', status: 'all' } });
          } else {
            void navigate({ to: adminPaths[section] });
          }
        }}
        onClient={() => void navigate({ to: '/cliente' })}
      />
      <Outlet />
    </>
  );
}
