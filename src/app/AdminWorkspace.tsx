import { Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import AdminPreview from '../AdminPreview';
import { adminPaths, adminSectionFromPath } from './navigation';

export function AdminWorkspace() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
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
