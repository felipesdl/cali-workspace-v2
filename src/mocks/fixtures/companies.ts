import { type Company, type CompanyAccess } from '../../api/modules/companies/schemas';

export const mockCompanyIds = {
  Aurora: '11111111-1111-4111-8111-111111111111',
  Norte: '22222222-2222-4222-8222-222222222222',
  Horizonte: '33333333-3333-4333-8333-333333333333',
} as const;

export const companies: Company[] = [
  {
    id: mockCompanyIds.Aurora,
    displayName: 'Aurora Tecnologia',
    plan: 'partner',
    status: 'active',
    createdOn: '2026-10-01',
  },
  {
    id: mockCompanyIds.Norte,
    displayName: 'Norte Digital',
    plan: 'full',
    status: 'paused',
    createdOn: '2026-09-15',
  },
  {
    id: mockCompanyIds.Horizonte,
    displayName: 'Ateliê Horizonte',
    plan: 'partner',
    status: 'blocked',
    createdOn: '2026-08-20',
  },
];

export const accesses: CompanyAccess[] = companies.flatMap((company, index) =>
  Array.from({ length: index === 0 ? 4 : 2 }, (_, offset) => ({
    id: `0000000${index + 1}-0000-4000-8000-00000000000${offset + 1}`,
    companyId: company.id,
    name: `Acesso demonstrativo ${offset + 1}`,
    email: `contato${offset + 1}.empresa${index + 1}@example.test`,
    status: 'active' as const,
    invitedOn: company.createdOn,
  })),
);
