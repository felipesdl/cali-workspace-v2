import { describe, expect, it } from 'vitest';
import { createSessionController, type SessionSource } from '../src/app/session/controller';
import { sessionGuard, safeReturnPath } from '../src/app/session/guard';
import { type WorkspaceAccessState } from '../src/api/modules/access/session';
import { createQueryClient } from '../src/api/query-client';

const ready = (): WorkspaceAccessState => ({
  status: 'ready',
  profile: {
    id: '20000000-0000-4000-8000-000000000001',
    company_id: null,
    role: 'admin',
    active: true,
  },
  companyStatus: null,
  termsAccepted: true,
  terms: {
    version: 'local-test',
    contentHash: 'a'.repeat(64),
    title: 'Teste',
    content: 'Texto sintético',
  },
});
describe('sessão preparada para fonte validada do servidor', () => {
  it('libera somente papel correto e nega erro/termos/MFA', async () => {
    const source: SessionSource = { read: async () => ready(), signOut: async () => {} };
    const session = createSessionController(source, createQueryClient());
    expect(sessionGuard(await session.resolve(), 'admin')).toBe('allowed');
    expect(sessionGuard(session.getSnapshot(), 'client')).toBe('wrong_role');
    source.read = async () => ({ ...ready(), status: 'terms_required', termsAccepted: false });
    expect(sessionGuard(await session.refresh(), 'admin')).toBe('terms_required');
    source.read = async () => ({ ...ready(), status: 'mfa_required' });
    expect(sessionGuard(await session.refresh(), 'admin')).toBe('mfa_required');
    source.read = async () => {
      throw new Error('falha');
    };
    expect(sessionGuard(await session.refresh(), 'admin')).toBe('unavailable');
  });
  it('resposta anterior não restaura sessão após logout e cache é limpo', async () => {
    let finish: (value: WorkspaceAccessState) => void = () => {};
    const cache = createQueryClient();
    cache.setQueryData(['private'], 'empresa anterior');
    const session = createSessionController(
      {
        read: () =>
          new Promise((done) => {
            finish = done;
          }),
        signOut: async () => {},
      },
      cache,
    );
    const pending = session.refresh();
    await Promise.resolve();
    await Promise.resolve();
    await session.signOut();
    finish(ready());
    await pending;
    expect(session.getSnapshot().phase).toBe('signed_out');
    expect(cache.getQueryData(['private'])).toBeUndefined();
  });
  it('nega snapshot ready inconsistente em vez de confiar no status isolado', async () => {
    const session = createSessionController(
      { read: async () => ({ ...ready(), termsAccepted: false }), signOut: async () => {} },
      createQueryClient(),
    );
    expect((await session.refresh()).phase).toBe('error');
  });
  it.each([
    'https://example.invalid',
    '//example.invalid',
    '/\\example.invalid',
    '/admin\nfoo',
    '/admin@evil',
  ])('recusa retorno externo/malformado: %s', (path) => {
    expect(safeReturnPath(path)).toBe('/cliente');
  });
});
