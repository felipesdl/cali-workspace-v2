import { workspaceRole } from '../api/access/schemas';
import { phase4CatalogFromPath } from './phase4-navigation';
import { teamSearchSchema, teamViews } from '../api/shared/team/schemas';
import { isPilotCompany } from '../api/admin/companies/onboarding';
import { Link, Outlet, useMatches, useRouteContext } from '@tanstack/react-router';
import { WorkspaceLayout } from './WorkspaceLayout';
import { workspaceModuleLink } from './workspace-navigation';
import { clientAccountPaths, clientPaths } from './navigation';
import { useOwnProfileQuery } from '../api/access/hooks/useOwnProfileQuery';
const navigation = [
  { to: clientPaths.overview, label: 'Início' },
  { to: clientAccountPaths.company, label: 'Minha empresa' },
  { to: clientAccountPaths.terms, label: 'Termos e privacidade' },
] as const;
const titles: Readonly<Record<string, string>> = {
  [clientPaths.overview]: 'Seu Workspace',
  [clientAccountPaths.company]: 'Minha empresa',
  '/cliente/minha-conta': 'Minha conta',
  '/cliente/ajuda': 'Dúvidas frequentes',
  [clientAccountPaths.terms]: 'Termos e privacidade',
  [clientPaths.team]: 'Equipe',
  '/cliente/perfil-comportamental': 'Perfil comportamental',
  '/cliente/propostas': 'Propostas',
  [clientPaths.hours]: 'Horas',
  [clientPaths.calendar]: 'Calendário',
  [clientPaths.records]: 'Ocorrências',
  [clientPaths.documents]: 'Documentos',
  [clientPaths.reports]: 'Relatórios',
  [clientPaths.projects]: 'Projetos e entregáveis',
  [clientPaths.notices]: 'Avisos',
};
const teamSections = [
  { view: teamViews.Directory, label: 'Diretório' },
  { view: teamViews.Structure, label: 'Estrutura organizacional' },
  { view: teamViews.History, label: 'Movimentações' },
  { view: teamViews.Monthly, label: 'Dados do mês' },
] as const;

export function ClientWorkspace() {
  const { session, team, monthly, disc } = useRouteContext({ from: '__root__' });
  const profile = useOwnProfileQuery();
  const { pathname, activeTeamView } = useMatches({
    select: (matches) => {
      const match = matches[matches.length - 1];
      const path = match?.pathname.replace(/\/$/, '') ?? '/cliente';
      return {
        pathname: path,
        activeTeamView:
          path === clientPaths.team ? teamSearchSchema.parse(match?.search ?? {}).view : undefined,
      };
    },
  });
  const visibleNavigation = session ? navigation : navigation.slice(0, 1);
  const modules = visibleNavigation.map(({ to, label }) =>
    workspaceModuleLink(label, <Link to={to} />),
  );
  modules.push(workspaceModuleLink('Ajuda', <Link to="/cliente/ajuda" />));
  if (disc)
    modules.push(
      workspaceModuleLink('Perfil comportamental', <Link to="/cliente/perfil-comportamental" />),
    );
  if (team) {
    const sections = isPilotCompany(profile.actor?.company_id ?? undefined)
      ? teamSections
          .filter(({ view }) => monthly || view !== teamViews.Monthly)
          .map(({ view, label }) => ({
            label,
            active: activeTeamView === view,
            element: <Link to={clientPaths.team} search={teamSearchSchema.parse({ view })} />,
          }))
      : undefined;
    modules.push(
      workspaceModuleLink(
        'Equipe',
        <Link to={clientPaths.team} search={teamSearchSchema.parse({})} />,
        sections,
      ),
    );
  }
  const firstName = profile.query.isSuccess
    ? profile.query.data?.full_name?.trim().split(/\s+/)[0]
    : undefined;
  const isHome = pathname === clientPaths.overview;
  return (
    <WorkspaceLayout
      title={
        isHome && firstName
          ? `Olá, ${firstName}`
          : (titles[pathname] ?? phase4CatalogFromPath(pathname)?.title ?? 'Seu Workspace')
      }
      headingArea={isHome && firstName ? 'Sua parceria com a CALI' : undefined}
      headingDescription={
        isHome && firstName
          ? 'Veja o que aconteceu e o que vem a seguir na sua assessoria.'
          : undefined
      }
      navigation={modules}
      role={workspaceRole.Client}
    >
      <Outlet />
    </WorkspaceLayout>
  );
}
