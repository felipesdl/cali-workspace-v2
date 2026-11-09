import { phase4CatalogFromPath } from './phase4-navigation';
import { teamSearchSchema } from '../api/modules/team/schemas';
import { Link, Outlet, useMatches, useRouteContext } from '@tanstack/react-router';
import { WorkspaceLayout } from './WorkspaceLayout';
import { WorkspaceNavLabel } from './WorkspaceNavLabel';
import { clientAccountPaths, clientPaths } from './navigation';
const navigation = [
  { to: clientPaths.overview, label: 'Início' },
  { to: clientAccountPaths.company, label: 'Minha empresa' },
  { to: clientAccountPaths.terms, label: 'Termos e privacidade' },
] as const;
const titles: Readonly<Record<string, string>> = {
  [clientPaths.overview]: 'Seu Workspace',
  [clientAccountPaths.company]: 'Minha empresa',
  [clientAccountPaths.terms]: 'Termos e privacidade',
  [clientPaths.team]: 'Equipe',
  '/cliente/perfil': 'Perfil comportamental',
  '/cliente/propostas': 'Propostas',
  [clientPaths.hours]: 'Horas',
  [clientPaths.calendar]: 'Calendário',
  [clientPaths.records]: 'Ocorrências',
  [clientPaths.documents]: 'Documentos',
  [clientPaths.reports]: 'Relatórios',
  [clientPaths.projects]: 'Projetos e entregáveis',
  [clientPaths.notices]: 'Avisos',
};
export function ConnectedClientWorkspace() {
  const { team, disc } = useRouteContext({ from: '__root__' });
  const pathname = useMatches({
    select: (matches) => matches[matches.length - 1]?.pathname ?? '/cliente',
  });
  return (
    <WorkspaceLayout
      title={titles[pathname] ?? phase4CatalogFromPath(pathname)?.title ?? 'Seu Workspace'}
      navigation={
        <>
          {navigation.map((item) => (
            <Link key={item.to} activeOptions={{ exact: true, includeSearch: false }} to={item.to}>
              <WorkspaceNavLabel label={item.label} />
            </Link>
          ))}
          {disc && (
            <Link to="/cliente/perfil" activeOptions={{ exact: true, includeSearch: false }}>
              <WorkspaceNavLabel label="Perfil comportamental" />
            </Link>
          )}
          {team && (
            <Link
              activeOptions={{ exact: true, includeSearch: false }}
              to={clientPaths.team}
              search={teamSearchSchema.parse({})}
            >
              <WorkspaceNavLabel label="Equipe" />
            </Link>
          )}
        </>
      }
    >
      <Outlet />
    </WorkspaceLayout>
  );
}
