import { describe, expect, it, vi } from 'vitest';
import { createAccessStateSource, type AccessPorts } from '../src/api/modules/access/service';
import { createSessionController } from '../src/app/session/controller';
import { createQueryClient } from '../src/api/query-client';
const id = '20000000-0000-4000-8000-000000000001';
const companyId = '10000000-0000-4000-8000-000000000001';
function ports(): AccessPorts {
  return {
    identity: async () => ({ id }),
    profile: async () => ({ id, role: 'admin', active: true, company_id: null }),
    company: async () => ({
      id: companyId,
      display_name: 'Teste',
      legal_name: 'Teste',
      status: 'active',
    }),
    adminMfaReady: async () => true,
    termsState: async () => ({
      terms: {
        version: 'test',
        title: 'Teste',
        content: 'Sintético',
        contentHash: 'a'.repeat(64),
      },
      accepted: true,
    }),
    signOut: async () => {},
  };
}
const signal = () => new AbortController().signal;
describe('estado agregado do backend hospedado', () => {
  it('confirma Admin apenas com perfil ativo, MFA e aceite corrente', async () => {
    const backend = ports();
    const source = createAccessStateSource(backend);
    expect((await source.read(signal())).status).toBe('ready');
    backend.adminMfaReady = async () => false;
    expect((await source.read(signal())).status).toBe('mfa_required');
    backend.adminMfaReady = async () => true;
    const published = await backend.termsState(signal());
    if (!published) throw new Error('Fixture sem publicação');
    backend.termsState = async () => ({ ...published, accepted: false });
    expect((await source.read(signal())).status).toBe('terms_required');
    backend.termsState = async () => null;
    expect((await source.read(signal())).status).toBe('terms_unavailable');
    backend.termsState = async () => {
      throw Error('permissão negada');
    };
    expect((await createSessionController(source, createQueryClient()).refresh()).phase).toBe(
      'error',
    );
  });
  it('nega perfil divergente, inativo e Partner antes de ler dados de negócio', async () => {
    const backend = ports();
    backend.company = vi.fn(backend.company);
    backend.profile = async () => ({ id, role: 'admin', active: false, company_id: null });
    expect((await createAccessStateSource(backend).read(signal())).status).toBe('blocked');
    backend.profile = async () => ({
      id: companyId,
      role: 'admin',
      active: true,
      company_id: null,
    });
    expect((await createAccessStateSource(backend).read(signal())).status).toBe('blocked');
    backend.profile = async () => ({ id, role: 'partner', active: true, company_id: null });
    expect((await createAccessStateSource(backend).read(signal())).status).toBe('blocked');
    expect(backend.company).not.toHaveBeenCalled();
  });
  it.each(['blocked', 'closed', 'archived'] as const)(
    'Cliente não entra em empresa %s',
    async (status) => {
      const backend = ports();
      backend.profile = async () => ({ id, role: 'client', active: true, company_id: companyId });
      backend.company = async () => ({
        id: companyId,
        display_name: 'Teste',
        legal_name: 'Teste',
        status,
      });
      expect((await createAccessStateSource(backend).read(signal())).status).toBe('blocked');
    },
  );
  it('Cliente pausado consulta; empresa diferente e ausência de vínculo não liberam', async () => {
    const backend = ports();
    backend.profile = async () => ({ id, role: 'client', active: true, company_id: companyId });
    backend.company = async () => ({
      id: companyId,
      display_name: 'Teste',
      legal_name: 'Teste',
      status: 'paused',
    });
    expect((await createAccessStateSource(backend).read(signal())).status).toBe('ready');
    backend.company = async () => ({
      id,
      display_name: 'Outra',
      legal_name: 'Outra',
      status: 'active',
    });
    expect((await createAccessStateSource(backend).read(signal())).status).toBe('blocked');
    backend.profile = async () => ({ id, role: 'client', active: true, company_id: null });
    expect((await createAccessStateSource(backend).read(signal())).status).toBe('blocked');
  });
  it('sem sessão não consulta perfil; cancelamento não prossegue', async () => {
    const backend = ports();
    backend.identity = async () => null;
    backend.profile = vi.fn(backend.profile);
    expect((await createAccessStateSource(backend).read(signal())).status).toBe('signed_out');
    expect(backend.profile).not.toHaveBeenCalled();
    const controller = new AbortController();
    controller.abort();
    await expect(createAccessStateSource(backend).read(controller.signal)).rejects.toThrow();
  });
});
