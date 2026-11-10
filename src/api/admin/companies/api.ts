import { createMockHttpClient } from '../../../mocks/http/client';
import { createCompaniesMockAdapter } from '../../../mocks/adapters/companies';
import { createCompaniesService } from './service';
import { createHostedCompaniesService } from './hosted';
import { type WorkspaceClient } from '../../supabase';

// Uma instância local no ciclo de vida da SPA. Não é uma sessão autenticada.
export const companiesService = createCompaniesService(
  createMockHttpClient(createCompaniesMockAdapter()),
);
export const mockActorId = 'mock-admin';

export function composeCompaniesService(client: WorkspaceClient | null) {
  return client ? createHostedCompaniesService(client) : companiesService;
}
