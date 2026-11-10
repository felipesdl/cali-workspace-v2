import { type Company } from '../../../../api/admin/companies/schemas';

export const companyPlanLabels = {
  full: 'CALI Full',
  partner: 'CALI Partner',
  build: 'CALI Build',
  build_essential: 'CALI Build Essencial',
  build_complete: 'CALI Build Completo',
} satisfies Record<NonNullable<Company['plan']>, string>;
