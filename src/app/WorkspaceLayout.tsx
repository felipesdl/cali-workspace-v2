import { phase4CatalogFromPath, phase4CatalogLinks } from './phase4-navigation';
import { workspaceSearch } from '../api/modules/project-workspace/schemas';
import { type ReactNode } from 'react';
import { Link, useMatches, useRouteContext } from '@tanstack/react-router';
import { isPilotCompany } from '../api/modules/companies/onboarding';
import { teamSearchSchema } from '../api/modules/team/schemas';
import { Button } from '../components/ds/button/Button';
import { WorkspaceFrame } from './WorkspaceFrame';
import { useWorkspaceSession } from '../api/modules/access/hooks/useWorkspaceSession';

const companyScopedAdminPaths = new Set([
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
  children,
  navigation,
}: {
  title: string;
  children: ReactNode;
  navigation?: ReactNode;
}) {
  const { session, team, disc, projectWorkspace, domainOperations, adminRead } = useRouteContext({
    from: '__root__',
  });
  const state = useWorkspaceSession();
  const admin = state.phase === 'resolved' && state.access.profile?.role === 'admin';
  const selectedCompany = useMatches({
    select: (matches) => {
      const match = matches[matches.length - 1];
      if (!match?.pathname.startsWith('/admin/')) return undefined;
      if (!companyScopedAdminPaths.has(match.pathname) && !phase4CatalogFromPath(match.pathname))
        return undefined;
      if (!('companyId' in match.search)) return undefined;
      const company = match.search.companyId;
      return typeof company === 'string' && isPilotCompany(company) ? company : undefined;
    },
  });
  const workspaceNavigationSearch = workspaceSearch.parse({
    companyId: admin ? selectedCompany : undefined,
  });
  return (
    <WorkspaceFrame
      title={title}
      actions={
        <Button variant="secondary" onClick={() => void session?.signOut()}>
          Sair
        </Button>
      }
      navigation={
        <>
          {navigation}
          {admin && (
            <Link
              activeOptions={{ exact: true, includeSearch: false }}
              to="/admin/clientes"
              search={{ q: '', status: 'all' }}
            >
              Empresas e acessos
            </Link>
          )}
          {admin && team && (
            <Link
              activeOptions={{ exact: true, includeSearch: false }}
              to="/admin/equipe"
              search={teamSearchSchema.parse({ companyId: selectedCompany })}
            >
              Equipe
            </Link>
          )}
          {admin && disc && (
            <Link
              to="/admin/perfil"
              search={{}}
              activeOptions={{ exact: true, includeSearch: false }}
            >
              Perfil comportamental
            </Link>
          )}
          {projectWorkspace && (
            <>
              <Link
                activeOptions={{ exact: true, includeSearch: false }}
                to={admin ? '/admin/projetos' : '/cliente/entregaveis'}
                search={workspaceNavigationSearch}
              >
                Projetos
              </Link>
              <Link
                activeOptions={{ exact: true, includeSearch: false }}
                to={admin ? '/admin/horas' : '/cliente/horas'}
                search={workspaceNavigationSearch}
              >
                Horas
              </Link>
              {phase4CatalogLinks.map((item) => (
                <Link
                  key={item.module}
                  activeOptions={{ exact: true, includeSearch: false }}
                  to={admin ? item.admin : item.client}
                  search={workspaceNavigationSearch}
                >
                  {item.title}
                </Link>
              ))}
            </>
          )}
          {admin && domainOperations && (
            <Link
              activeOptions={{ exact: true, includeSearch: false }}
              to="/admin/privacidade"
              search={workspaceNavigationSearch}
            >
              Privacidade
            </Link>
          )}
          {admin && domainOperations && (
            <Link
              activeOptions={{ exact: true, includeSearch: false }}
              to="/admin/formularios"
              search={workspaceNavigationSearch}
            >
              Formulários
            </Link>
          )}
          {!admin && adminRead && domainOperations && (
            <Link activeOptions={{ exact: true, includeSearch: false }} to="/cliente/propostas">
              Propostas
            </Link>
          )}
          {admin && adminRead && (
            <>
              <Link
                activeOptions={{ exact: true, includeSearch: false }}
                to="/admin/propostas"
                search={workspaceNavigationSearch}
              >
                Propostas
              </Link>
              <Link
                activeOptions={{ exact: true, includeSearch: false }}
                to="/admin/mapa-people"
                search={workspaceNavigationSearch}
              >
                Mapa de People
              </Link>
              <Link
                activeOptions={{ exact: true, includeSearch: false }}
                to="/admin/equipe-cali"
                search={workspaceNavigationSearch}
              >
                Equipe CALI
              </Link>
              <Link
                activeOptions={{ exact: true, includeSearch: false }}
                to="/admin/auditoria"
                search={workspaceNavigationSearch}
              >
                Auditoria
              </Link>
              <Link
                activeOptions={{ exact: true, includeSearch: false }}
                to="/admin/satisfacao"
                search={workspaceNavigationSearch}
              >
                Satisfação
              </Link>
            </>
          )}
        </>
      }
    >
      {children}
    </WorkspaceFrame>
  );
}
