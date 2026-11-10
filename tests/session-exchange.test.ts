// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createSessionExchange } from '../supabase/functions/workspace-access/session-exchange.ts';

const userId = '20000000-0000-4000-8000-000000000001';
const sessionId = '30000000-0000-4000-8000-000000000001';
const authorizationId = '40000000-0000-4000-8000-000000000001';
const subject = { email: 'login@example.test', role: 'client', userId, authorizationId } as const;
// Token sintético sem assinatura; somente a resposta confiável do port Auth é simulada.
const token = `header.${btoa(JSON.stringify({ sub: userId, session_id: sessionId }))}.signature`;
function ports() {
  return {
    authenticate: vi.fn(async () => ({
      access_token: token,
      refresh_token: 'synthetic-refresh',
      user: { id: userId },
    })),
    admit: vi.fn(async (_authorizationId: string, _sessionId: string) => true),
    revoke: vi.fn(async (_token: string) => {}),
  };
}
describe('troca e admissão de sessão no servidor', () => {
  it('só devolve a sessão após confirmar a admissão ligada ao código', async () => {
    const dependencies = ports();
    expect(await createSessionExchange(dependencies)(subject)).toEqual({
      access_token: token,
      refresh_token: 'synthetic-refresh',
    });
    expect(dependencies.admit).toHaveBeenCalledWith(authorizationId, sessionId);
    expect(dependencies.revoke).not.toHaveBeenCalled();
  });
  it('corte durante a troca impede a devolução da sessão e solicita logout', async () => {
    const dependencies = ports();
    let cut = false;
    dependencies.authenticate.mockImplementation(async () => {
      cut = true;
      return { access_token: token, refresh_token: 'synthetic-refresh', user: { id: userId } };
    });
    dependencies.admit.mockImplementation(async () => !cut);
    await expect(createSessionExchange(dependencies)(subject)).rejects.toThrow(
      'confirmar a sessão',
    );
    expect(dependencies.revoke).toHaveBeenCalledWith(token);
  });
  it('identidade divergente não chega à admissão', async () => {
    const dependencies = ports();
    dependencies.authenticate.mockResolvedValue({
      access_token: token,
      refresh_token: 'synthetic-refresh',
      user: { id: sessionId },
    });
    await expect(createSessionExchange(dependencies)(subject)).rejects.toThrow();
    expect(dependencies.admit).not.toHaveBeenCalled();
    expect(dependencies.revoke).toHaveBeenCalledOnce();
  });
  it('falhas de admissão e logout não expõem credenciais ou detalhes internos', async () => {
    const dependencies = ports();
    dependencies.admit.mockRejectedValue(new Error('private database failure'));
    dependencies.revoke.mockRejectedValue(new Error('private auth failure'));
    await expect(createSessionExchange(dependencies)(subject)).rejects.toThrow(
      'Não foi possível confirmar a sessão.',
    );
  });
});
