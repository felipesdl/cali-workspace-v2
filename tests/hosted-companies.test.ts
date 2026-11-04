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
  it('edita somente os nomes com comparação atômica e confirma a linha retornada', async () => {
    const { service, request } = backend({
      ...row,
      display_name: 'Novo nome',
      legal_name: 'Nova razão',
    });
    const result = await service.updateBasics({
      companyId: id,
      expected: { displayName: row.display_name, legalName: row.legal_name },
      values: { displayName: '  Novo nome  ', legalName: ' Nova razão ' },
    });
    expect(result).toMatchObject({ id, displayName: 'Novo nome', legalName: 'Nova razão' });
    const [input, init] = request.mock.calls[0];
    const url = new URL(String(input));
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({
      display_name: 'Novo nome',
      legal_name: 'Nova razão',
    });
    expect(url.searchParams.get('id')).toBe(`eq.${id}`);
    expect(url.searchParams.get('display_name')).toBe('eq.Teste A');
    expect(url.searchParams.get('legal_name')).toBe('eq.Teste A');
  });
  it('não confirma zero linhas, retorno alheio ou alteração diferente da solicitada', async () => {
    const input = {
      companyId: id,
      expected: { displayName: 'Teste A', legalName: 'Teste A' },
      values: { displayName: 'Novo', legalName: '' },
    };
    await expect(backend([]).service.updateBasics(input)).rejects.toThrow(
      'edição não foi confirmada',
    );
    await expect(
      backend({
        ...row,
        display_name: 'Novo',
        legal_name: 'Novo',
        id: '10000000-0000-4000-8000-000000000002',
      }).service.updateBasics(input),
    ).rejects.toThrow('confirmar a alteração');
    await expect(backend(row).service.updateBasics(input)).rejects.toThrow('confirmar a alteração');
  });
  it('razão social vazia acompanha nome; entrada inválida não dispara PATCH', async () => {
    const { service, request } = backend({ ...row, display_name: 'Novo', legal_name: 'Novo' });
    await service.updateBasics({
      companyId: id,
      expected: { displayName: 'Teste A', legalName: 'Teste A' },
      values: { displayName: 'Novo', legalName: '' },
    });
    expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toEqual({
      display_name: 'Novo',
      legal_name: 'Novo',
    });
    request.mockClear();
    await expect(
      service.updateBasics({
        companyId: id,
        expected: { displayName: 'Teste A', legalName: 'Teste A' },
        values: { displayName: ' ', legalName: '' },
      }),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it('consulta Cliente usa projeção mínima, filtro de vínculo e GET sem gestão', async () => {
    const identity = {
      id,
      display_name: 'Empresa própria',
      legal_name: 'Razão própria',
      status: 'paused',
    };
    const { service, request } = backend(identity);
    const controller = new AbortController();
    expect(await service.account(id, controller.signal)).toEqual({
      id,
      displayName: 'Empresa própria',
      legalName: 'Razão própria',
      status: 'paused',
    });
    const [input, init] = request.mock.calls[0];
    const url = new URL(String(input));
    expect(url.searchParams.get('select')).toBe('id,display_name,legal_name,status');
    expect(url.searchParams.get('id')).toBe(`eq.${id}`);
    expect(init?.method).toBe('GET');
    expect(init?.signal).toBe(controller.signal);
    expect(new Headers(init?.headers).get('Accept-Profile')).toBe('cali_workspace');
    expect(service.management).toBeNull();
  });
  it('consulta Cliente distingue linha ausente, falha e empresa divergente; não traz fixtures', async () => {
    expect(await backend([]).service.account(id)).toBeNull();
    await expect(backend({ code: '42501' }, 403).service.account(id)).rejects.toThrow('consultar');
    await expect(
      backend({
        id: '10000000-0000-4000-8000-000000000002',
        display_name: 'Outra',
        legal_name: 'Outra',
        status: 'active',
      }).service.account(id),
    ).rejects.toThrow('incompatível');
    const { service, request } = backend([]);
    await expect(service.account('invalid')).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
    const controller = new AbortController();
    controller.abort();
    await expect(service.account(id, controller.signal)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it('separa a capacidade de rascunhos da gestão de empresas e acessos', () => {
    const { service, request } = backend([]);
    expect(service.management).toBeNull();
    expect(service.onboarding).not.toBeNull();
    expect(request).not.toHaveBeenCalled();
  });

  it('lista rascunhos via GET no schema correto e omite cursor na primeira página', async () => {
    const { service, request } = backend([]);
    const signal = new AbortController().signal;
    await expect(service.onboarding?.list(null, signal)).resolves.toEqual({
      items: [],
      next: null,
    });
    const [input, init] = request.mock.calls[0];
    const url = new URL(String(input));
    expect(url.pathname).toBe('/rest/v1/rpc/v2_list_company_drafts');
    expect(url.searchParams.has('p_before')).toBe(false);
    expect(init?.method).toBe('GET');
    expect(init?.signal).toBe(signal);
    expect(new Headers(init?.headers).get('Accept-Profile')).toBe('cali_workspace');
  });

  it('envia a preimagem da comprovação e distingue conflito de versão', async () => {
    const { service, request } = backend({ code: '40001' }, 409);
    const expected = '10000000-0000-4000-8000-000000000002';
    const requestId = '10000000-0000-4000-8000-000000000003';
    await expect(
      service.onboarding?.review(id, requestId, expected, {
        action: 'withdrawn',
        note: 'Versão substituída',
      }),
    ).rejects.toThrow('A comprovação mudou');
    const [input, init] = request.mock.calls[0];
    expect(new URL(String(input)).pathname).toBe('/rest/v1/rpc/v2_review_company_adhesion');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      p_draft_id: id,
      p_request_id: requestId,
      p_expected_event_id: expected,
      p_action: 'withdrawn',
      p_evidence_reference: null,
      p_document_revision: null,
      p_note: 'Versão substituída',
    });
  });
  it('cria a empresa definitiva pela RPC vinculada ao rascunho', async () => {
    const companyId = '10000000-0000-4000-8000-000000000004';
    const { service, request } = backend({ value: companyId });
    request.mockResolvedValueOnce(
      new Response(JSON.stringify(companyId), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await expect(service.onboarding?.materialize(id)).resolves.toBe(companyId);
    const [input, init] = request.mock.calls[0];
    expect(new URL(String(input)).pathname).toBe('/rest/v1/rpc/v2_materialize_company');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ p_draft_id: id });
  });
});
