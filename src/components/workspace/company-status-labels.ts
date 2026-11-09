import { type CompanyFilters } from '../../api/admin/companies/schemas';
export const companyStatusLabels = {
  all: 'Todas as situações',
  active: 'Ativa',
  paused: 'Pausada',
  blocked: 'Bloqueada',
  closed: 'Encerrada',
  archived: 'Arquivada',
} satisfies Record<CompanyFilters['status'], string>;
