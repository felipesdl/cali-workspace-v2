import { Outlet, useLocation, useNavigate, useRouteContext } from '@tanstack/react-router';
import AdminPreview from '../AdminPreview';
import { adminPaths, adminSectionFromPath } from './navigation';
import { WorkspaceLayout } from './WorkspaceLayout';
import { CompaniesPage } from '../features/companies/CompaniesPage';

export function AdminWorkspace() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
  const { access } = useRouteContext({ from: '__root__' });
  if (access)
    return (
      <WorkspaceLayout title="Empresas e acessos">
        {pathname === '/admin/clientes' ? (
          <CompaniesPage />
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
