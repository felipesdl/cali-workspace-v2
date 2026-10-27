import { type CompanyAccess } from '../../src/api/modules/companies/schemas';

export const unknownCompanyId = '99999999-9999-4999-8999-999999999999';

// Cenário adverso: resposta válida que pertence a outra empresa.
export const foreignCompanyAccesses: CompanyAccess[] = [
  {
    id: '44444444-4444-4444-8444-444444444444',
    companyId: '55555555-5555-4555-8555-555555555555',
    name: 'Acesso exclusivo de teste',
    email: 'foreign-access@example.test',
    status: 'active',
    invitedOn: '2026-10-01',
  },
];
