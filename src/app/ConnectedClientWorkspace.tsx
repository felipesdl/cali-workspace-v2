import { phase4CatalogFromPath } from './phase4-navigation';
import { teamSearchSchema } from '../api/modules/team/schemas';
import { Link, Outlet, useMatches, useRouteContext } from '@tanstack/react-router';
import { WorkspaceLayout } from './WorkspaceLayout';
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
            <Link
              key={item.to}
              className="tw:text-brand tw:underline-offset-4 tw:visited:text-brand tw:focus-visible:outline-2 tw:focus-visible:outline-offset-3 tw:focus-visible:outline-focus"
              activeOptions={{ exact: true, includeSearch: false }}
              activeProps={{ 'aria-current': 'page', className: 'tw:font-semibold tw:underline' }}
              to={item.to}
            >
              {item.label}
            </Link>
          ))}
          {disc && (
            <Link
              to="/cliente/perfil"
              className="tw:text-brand tw:underline-offset-4 tw:focus-visible:outline-2 tw:focus-visible:outline-focus"
            >
              Perfil comportamental
            </Link>
          )}
          {team && (
            <Link
              className="tw:text-brand tw:underline-offset-4 tw:visited:text-brand tw:focus-visible:outline-2 tw:focus-visible:outline-offset-3 tw:focus-visible:outline-focus"
              activeOptions={{ exact: true, includeSearch: false }}
              activeProps={{ 'aria-current': 'page', className: 'tw:font-semibold tw:underline' }}
              to={clientPaths.team}
              search={teamSearchSchema.parse({})}
            >
              Equipe
            </Link>
          )}
        </>
      }
    >
      <Outlet />
    </WorkspaceLayout>
  );
}
