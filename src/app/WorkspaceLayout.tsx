import { workspaceRole } from '../api/access/schemas';
import { NotificationInbox } from '../components/notifications/NotificationInbox';
import { phase4CatalogFromPath, phase4CatalogLinks } from './phase4-navigation';
import { workspaceSearch } from '../api/shared/workspace/schemas';
import { type ReactNode } from 'react';
import { Link, useMatches, useRouteContext } from '@tanstack/react-router';
import { isPilotCompany } from '../api/admin/companies/onboarding';
import { teamSearchSchema } from '../api/shared/team/schemas';
import { Button } from '../components/ds/button/Button';
import { WorkspaceFrame } from './WorkspaceFrame';
import { workspaceModuleLink, type WorkspaceModuleLink } from './workspace-navigation';
import { useWorkspaceSession } from '../api/access/hooks/useWorkspaceSession';

const companyScopedAdminPaths = new Set([
  '/admin',
  '/admin/equipe',
  '/admin/projetos',
  '/admin/horas',
  '/admin/formularios',
  '/admin/privacidade',
  '/admin/propostas',
  '/admin/mapa-people',
  '/admin/equipe-cali',
  '/admin/auditoria',
  '/admin/satisfacao',
]);

export function WorkspaceLayout({
  title,
  role,
  children,
  navigation,
}: {
  title: string;
  role: typeof workspaceRole.Admin | typeof workspaceRole.Client;
  children: ReactNode;
  navigation?: readonly WorkspaceModuleLink[];
}) {
  const {
    session,
    team,
    disc,
    projectWorkspace,
    domainOperations,
    adminRead,
    ownProfile,
    notifications,
  } = useRouteContext({
    from: '__root__',
  });
  const state = useWorkspaceSession();
  const profile =
    state.phase === 'resolved' && state.access.status === 'ready' ? state.access.profile : null;
  const admin = (session ? profile?.role : role) === workspaceRole.Admin;
  const recipient =
    profile?.active &&
    (profile.role === workspaceRole.Admin || profile.role === workspaceRole.Client)
      ? { id: profile.id, role: profile.role, company_id: profile.company_id }
      : null;
  const selectedCompany = useMatches({
    select: (matches) => {
      const match = matches[matches.length - 1];
      const pathname = match?.pathname.replace(/\/$/, '');
      if (!match || !pathname) return undefined;
      if (!companyScopedAdminPaths.has(pathname) && !phase4CatalogFromPath(pathname))
        return undefined;
      if (!('companyId' in match.search)) return undefined;
      const company = match.search.companyId;
      return typeof company === 'string' && isPilotCompany(company) ? company : undefined;
    },
  });
  const workspaceNavigationSearch = workspaceSearch.parse({
    companyId: admin ? selectedCompany : undefined,
  });
  const modules = [...(navigation ?? [])];
  if (admin) {
    modules.push(
      workspaceModuleLink('Início', <Link to="/admin" search={{ companyId: selectedCompany }} />),
      workspaceModuleLink(
        'Empresas e acessos',
        <Link to="/admin/clientes" search={{ q: '', status: 'all' }} />,
      ),
    );
    if (team) {
      modules.push(
        workspaceModuleLink(
          'Equipe',
          <Link
            to="/admin/equipe"
            search={teamSearchSchema.parse({ companyId: selectedCompany })}
          />,
        ),
      );
    }
    if (disc)
      modules.push(
        workspaceModuleLink('Perfil comportamental', <Link to="/admin/perfil" search={{}} />),
      );
  }
  if (ownProfile) {
    modules.push(
      workspaceModuleLink(
        'Minha conta',
        <Link to={admin ? '/admin/minha-conta' : '/cliente/minha-conta'} />,
      ),
    );
  }
  if (projectWorkspace) {
    modules.push(
      workspaceModuleLink(
        'Projetos',
        <Link
          to={admin ? '/admin/projetos' : '/cliente/entregaveis'}
          search={workspaceNavigationSearch}
        />,
      ),
      workspaceModuleLink(
        'Horas',
        <Link to={admin ? '/admin/horas' : '/cliente/horas'} search={workspaceNavigationSearch} />,
      ),
      ...phase4CatalogLinks.map((item) =>
        workspaceModuleLink(
          item.title,
          <Link to={admin ? item.admin : item.client} search={workspaceNavigationSearch} />,
        ),
      ),
    );
  }
  if (admin && domainOperations) {
    modules.push(
      workspaceModuleLink(
        'Privacidade',
        <Link to="/admin/privacidade" search={workspaceNavigationSearch} />,
      ),
      workspaceModuleLink(
        'Formulários',
        <Link to="/admin/formularios" search={workspaceNavigationSearch} />,
      ),
    );
  }
  if (admin && adminRead) {
    modules.push(
      workspaceModuleLink(
        'Propostas',
        <Link to="/admin/propostas" search={workspaceNavigationSearch} />,
      ),
      workspaceModuleLink(
        'Mapa de People',
        <Link to="/admin/mapa-people" search={workspaceNavigationSearch} />,
      ),
      workspaceModuleLink(
        'Equipe CALI',
        <Link to="/admin/equipe-cali" search={workspaceNavigationSearch} />,
      ),
      workspaceModuleLink(
        'Auditoria',
        <Link to="/admin/auditoria" search={workspaceNavigationSearch} />,
      ),
      workspaceModuleLink(
        'Satisfação',
        <Link to="/admin/satisfacao" search={workspaceNavigationSearch} />,
      ),
    );
  }
  if (!admin && adminRead && domainOperations) {
    modules.push(workspaceModuleLink('Propostas', <Link to="/cliente/propostas" />));
  }

  return (
    <WorkspaceFrame
      title={title}
      area={admin ? 'Backoffice / CALI RH' : 'Área da empresa'}
      actions={
        <div className="tw:relative tw:flex tw:shrink-0 tw:items-center tw:gap-2">
          {notifications && recipient && (
            <NotificationInbox
              key={`${recipient.id}:${recipient.role}:${recipient.company_id}`}
              service={notifications}
              recipient={recipient}
            />
          )}
          {session && (
            <Button variant="secondary" onClick={() => void session.signOut()}>
              Sair
            </Button>
          )}
        </div>
      }
      modules={modules}
    >
      {children}
    </WorkspaceFrame>
  );
}
