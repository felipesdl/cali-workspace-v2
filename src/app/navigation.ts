export const clientPaths = {
  overview: '/cliente',
  team: '/cliente/equipe',
  hours: '/cliente/horas',
  calendar: '/cliente/cronograma',
  records: '/cliente/registros',
  documents: '/cliente/documentos',
  reports: '/cliente/relatorios',
  deliverables: '/cliente/entregaveis',
  projects: '/cliente/entregaveis',
  notices: '/cliente/avisos',
} as const;

export const adminPaths = {
  overview: '/admin',
  accounts: '/admin/clientes',
  projects: '/admin/projetos',
  hours: '/admin/horas',
  calendar: '/admin/calendario',
  records: '/admin/registros',
  documents: '/admin/documentos',
  reports: '/admin/relatorios',
  notices: '/admin/avisos',
  people: '/admin/equipe',
  proposals: '/admin/propostas',
} as const;

export type ClientPage = keyof typeof clientPaths;
export type AdminSection = keyof typeof adminPaths;

export function clientPageFromPath(pathname: string): ClientPage {
  const found = Object.entries(clientPaths).find(
    ([key, path]) => path === pathname && key !== 'deliverables',
  );
  return (found?.[0] as ClientPage | undefined) ?? 'overview';
}

export function adminSectionFromPath(pathname: string): AdminSection {
  const found = Object.entries(adminPaths).find(([, path]) => path === pathname);
  return (found?.[0] as AdminSection | undefined) ?? 'overview';
}
