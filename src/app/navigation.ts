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

export const clientAccountPaths = {
  company: '/cliente/empresa',
  terms: '/cliente/termos',
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
