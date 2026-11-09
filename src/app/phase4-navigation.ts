import { type CatalogModule } from '../api/shared/workspace/schemas';

export const phase4CatalogLinks = [
  {
    admin: '/admin/calendario',
    client: '/cliente/cronograma',
    module: 'calendar',
    title: 'Agenda',
  },
  {
    admin: '/admin/registros',
    client: '/cliente/registros',
    module: 'records',
    title: 'Ocorrências',
  },
  {
    admin: '/admin/documentos',
    client: '/cliente/documentos',
    module: 'documents',
    title: 'Documentos',
  },
  { admin: '/admin/avisos', client: '/cliente/avisos', module: 'notices', title: 'Avisos' },
  {
    admin: '/admin/relatorios',
    client: '/cliente/relatorios',
    module: 'reports',
    title: 'Relatórios',
  },
  {
    admin: '/admin/frentes',
    client: '/cliente/frentes',
    module: 'fronts',
    title: 'Frentes contratadas',
  },
] as const satisfies ReadonlyArray<{
  admin: string;
  client: string;
  module: CatalogModule;
  title: string;
}>;

export function phase4CatalogFromPath(path: string) {
  return phase4CatalogLinks.find((item) => item.admin === path || item.client === path);
}
