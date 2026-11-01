import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { createHostedCompaniesService } from '../src/api/modules/companies/hosted';
const id = '10000000-0000-4000-8000-000000000001';
const row = {
  id,
  display_name: 'Teste A',
  legal_name: 'Teste A',
  status: 'active',
  service_plan: 'full',
  service_type: 'CALI Full',
  created_at: '2026-11-01T12:00:00Z',
};
function backend(response: object, status = 200) {
  const request = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(response), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  const client = createClient('https://example.supabase.co', 'sb_publishable_test', {
    db: { schema: 'cali_workspace' },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: request },
  });
  return { service: createHostedCompaniesService(client), request };
}
describe('projeções de empresas do hospedado', () => {
  it('faz GET com schema e filtros sem inventar plano para valor não reconhecido', async () => {
    const { service, request } = backend([{ ...row, service_plan: 'outro' }]);
    expect(await service.list({ q: 'TESTE', status: 'active' })).toEqual([
      { id, displayName: 'Teste A', plan: null, status: 'active', createdOn: '2026-11-01' },
    ]);
    const url = new URL(String(request.mock.calls[0][0]));
    expect(url.searchParams.get('status')).toBe('eq.active');
    expect(url.searchParams.get('select')).not.toBe('*');
    expect(request.mock.calls[0][1]?.method).toBe('GET');
    expect(new Headers(request.mock.calls[0][1]?.headers).get('Accept-Profile')).toBe(
      'cali_workspace',
    );
  });
  it('rejeita retorno de detalhe e convite vinculados a outra empresa', async () => {
    await expect(
      backend({ ...row, id: '10000000-0000-4000-8000-000000000002' }).service.detail(id),
    ).rejects.toThrow();
    const invite = {
      id,
      company_id: '10000000-0000-4000-8000-000000000002',
      email: 'test@example.test',
      full_name: 'Teste',
      active: true,
      platform_access: true,
      is_primary: false,
      invited_at: null,
    };
    await expect(backend([invite]).service.accesses(id)).rejects.toThrow();
  });
  it('convite sem envio não recebe data fabricada; flag de acesso é respeitada', async () => {
    const invite = {
      id,
      company_id: id,
      email: 'test@example.test',
      full_name: 'Teste',
      active: true,
      platform_access: false,
      is_primary: false,
      invited_at: null,
    };
    expect((await backend([invite]).service.accesses(id))[0]).toMatchObject({
      status: 'revoked',
      invitedOn: null,
    });
  });
  it('falha de permissão permanece erro sem fallback para fixtures', async () => {
    await expect(
      backend({ code: '42501' }, 403).service.list({ q: '', status: 'all' }),
    ).rejects.toThrow('Não foi possível consultar');
  });
});
