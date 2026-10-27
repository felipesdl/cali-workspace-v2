import { createMockHttpClient } from '../../../mocks/http/client';
import { createCompaniesMockAdapter } from '../../../mocks/adapters/companies';
import { createCompaniesService } from './service';

// Uma instância local no ciclo de vida da SPA. Não é uma sessão autenticada.
export const companiesService = createCompaniesService(
  createMockHttpClient(createCompaniesMockAdapter()),
);
export const mockActorId = 'mock-admin';
