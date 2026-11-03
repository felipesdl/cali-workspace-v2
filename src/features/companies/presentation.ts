import { type Company, type CompanyFilters } from '../../api/modules/companies/schemas';

export const companyStatusLabels = {
  all: 'Todas as situações',
  active: 'Ativa',
  paused: 'Pausada',
  blocked: 'Bloqueada',
  closed: 'Encerrada',
  archived: 'Arquivada',
} satisfies Record<CompanyFilters['status'], string>;

export const companyPlanLabels = {
  full: 'CALI Full',
  partner: 'CALI Partner',
  build: 'CALI Build',
} satisfies Record<NonNullable<Company['plan']>, string>;
