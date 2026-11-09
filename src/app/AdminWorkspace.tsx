import { Outlet, useMatches, useRouteContext } from '@tanstack/react-router';
import { workspaceRole } from '../api/access/schemas';
import { adminPaths } from './navigation';
import { phase4CatalogFromPath } from './phase4-navigation';
import { WorkspaceLayout } from './WorkspaceLayout';

export function AdminWorkspace() {
  const pathname = useMatches({
    select: (matches) =>
      matches[matches.length - 1]?.pathname.replace(/\/$/, '') ?? adminPaths.overview,
  });
  const { team, disc, projectWorkspace, adminRead } = useRouteContext({ from: '__root__' });
  const catalog = phase4CatalogFromPath(pathname);
  const sections: Readonly<Record<string, { title: string; available: boolean }>> = {
    [adminPaths.overview]: { title: 'Visão executiva', available: true },
    [adminPaths.accounts]: { title: 'Empresas e acessos', available: true },
    '/admin/minha-conta': { title: 'Minha conta', available: true },
    [adminPaths.people]: { title: 'Equipe', available: Boolean(team) },
    '/admin/perfil': { title: 'Perfil comportamental', available: Boolean(disc) },
    '/admin/mapa-people': { title: 'Mapa de People', available: Boolean(adminRead) },
    '/admin/satisfacao': { title: 'Satisfação', available: Boolean(adminRead) },
    '/admin/auditoria': { title: 'Auditoria', available: Boolean(adminRead) },
    [adminPaths.proposals]: { title: 'Propostas', available: Boolean(adminRead) },
    '/admin/equipe-cali': { title: 'Equipe CALI', available: Boolean(adminRead) },
    '/admin/formularios': { title: 'Formulários', available: Boolean(projectWorkspace) },
    '/admin/privacidade': { title: 'Privacidade', available: Boolean(projectWorkspace) },
    [adminPaths.projects]: { title: 'Projetos', available: Boolean(projectWorkspace) },
    [adminPaths.hours]: { title: 'Horas', available: Boolean(projectWorkspace) },
  };
  const section = sections[pathname];
  const title = section?.title ?? catalog?.title ?? 'Empresas e acessos';
  const available = section?.available ?? Boolean(catalog && projectWorkspace);

  return (
    <WorkspaceLayout title={title} role={workspaceRole.Admin}>
      {available ? (
        <Outlet />
      ) : (
        <p>Esta área está em preparação. Acesse Empresas e acessos para acompanhar as contas.</p>
      )}
    </WorkspaceLayout>
  );
}
