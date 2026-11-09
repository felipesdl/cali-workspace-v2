import { phase4CatalogFromPath } from './phase4-navigation';
import { teamSearchSchema } from '../api/modules/team/schemas';
import { Link, Outlet, useMatches, useRouteContext } from '@tanstack/react-router';
import { WorkspaceLayout } from './WorkspaceLayout';
import { workspaceModuleLink } from './workspace-navigation';
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
  const modules = navigation.map(({ to, label }) => workspaceModuleLink(label, <Link to={to} />));
  if (disc)
    modules.push(workspaceModuleLink('Perfil comportamental', <Link to="/cliente/perfil" />));
  if (team) {
    modules.push(
      workspaceModuleLink(
        'Equipe',
        <Link to={clientPaths.team} search={teamSearchSchema.parse({})} />,
      ),
    );
  }
  return (
    <WorkspaceLayout
      title={titles[pathname] ?? phase4CatalogFromPath(pathname)?.title ?? 'Seu Workspace'}
      navigation={modules}
    >
      <Outlet />
    </WorkspaceLayout>
  );
}
