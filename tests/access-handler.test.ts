// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  createAccessHandler,
  type AccessPorts,
} from '../supabase/functions/workspace-access/handler.ts';

function ports(): AccessPorts {
  return {
    randomCode: () => '001234',
    hash: async () => 'hash',
    issue: async () => ({ status: 'issued', id: 'id' }),
    delivered: vi.fn(async () => {}),
    consume: async () => ({
      email: 'user@example.test',
      role: 'client',
      userId: '20000000-0000-4000-8000-000000000001',
      authorizationId: '30000000-0000-4000-8000-000000000001',
    }),
    send: vi.fn(async () => {}),
    session: async () => ({ access_token: 'access', refresh_token: 'refresh' }),
  };
}
function request(body: object, origin = 'http://127.0.0.1:5173') {
  return new Request('http://local/functions/v1/workspace-access', {
    method: 'POST',
    headers: { origin },
    body: JSON.stringify(body),
  });
}
describe('fronteira pública de código', () => {
  it('nega origem e campos de autorização antes de tocar nos dados', async () => {
    const dependencies = ports();
    dependencies.issue = vi.fn(dependencies.issue);
    const handler = createAccessHandler(dependencies);
    expect(
      (
        await handler(
          request({ action: 'request', email: 'user@example.test' }, 'https://example.invalid'),
        )
      ).status,
    ).toBe(403);
    expect(
      (await handler(request({ action: 'request', email: 'user@example.test', role: 'admin' })))
        .status,
    ).toBe(400);
    expect(dependencies.issue).not.toHaveBeenCalled();
  });
  it('preserva zero inicial e confirma entrega antes da resposta', async () => {
    const dependencies = ports();
    const handler = createAccessHandler(dependencies);
    const result = await handler(request({ action: 'request', email: 'User@example.test' }));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ ok: true });
    expect(dependencies.send).toHaveBeenCalledWith('user@example.test', '001234');
    expect(dependencies.delivered).toHaveBeenCalledWith('id', true);
    expect(result.headers.get('cache-control')).toBe('no-store');
  });
  it('falha de entrega invalida o código e não retorna desafio', async () => {
    const dependencies = ports();
    dependencies.send = async () => {
      throw new Error('captura indisponível');
    };
    const result = await createAccessHandler(dependencies)(
      request({ action: 'request', email: 'user@example.test' }),
    );
    expect(result.status).toBe(500);
    expect(dependencies.delivered).toHaveBeenCalledWith('id', false);
    expect(await result.text()).not.toContain('captura indisponível');
  });
  it('limite de emissão impede novo envio e nova confirmação', async () => {
    const dependencies = ports();
    dependencies.issue = async () => ({ status: 'limited' });
    const result = await createAccessHandler(dependencies)(
      request({ action: 'request', email: 'user@example.test' }),
    );
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ ok: true });
    expect(dependencies.send).not.toHaveBeenCalled();
    expect(dependencies.delivered).not.toHaveBeenCalled();
  });
  it('falha ao confirmar código enviado não anuncia sucesso nem reenvia', async () => {
    const dependencies = ports();
    dependencies.delivered = vi.fn(async (_id, delivered) => {
      if (delivered) throw new Error('falha interna ao registrar entrega');
    });
    const result = await createAccessHandler(dependencies)(
      request({ action: 'request', email: 'user@example.test' }),
    );
    expect(result.status).toBe(500);
    expect(dependencies.send).toHaveBeenCalledOnce();
    expect(dependencies.delivered).toHaveBeenNthCalledWith(1, 'id', true);
    expect(dependencies.delivered).toHaveBeenNthCalledWith(2, 'id', false);
    expect(await result.json()).toEqual({
      error: 'Não foi possível concluir o acesso. Tente novamente.',
    });
  });
  it('falha de geração Auth mantém consumo e não retorna token', async () => {
    const dependencies = ports();
    dependencies.consume = vi.fn(dependencies.consume);
    dependencies.session = async () => {
      throw new Error('segredo interno');
    };
    const result = await createAccessHandler(dependencies)(
      request({ action: 'verify', email: 'user@example.test', code: '001234' }),
    );
    expect(result.status).toBe(500);
    expect(dependencies.consume).toHaveBeenCalledOnce();
    expect(await result.text()).not.toContain('segredo');
  });
  it('não emite token para código negado e mantém resposta genérica para conta ausente', async () => {
    const dependencies = ports();
    dependencies.issue = async () => ({ status: 'unavailable' });
    dependencies.consume = async () => null;
    dependencies.session = vi.fn(dependencies.session);
    const handler = createAccessHandler(dependencies);
    expect(
      await (await handler(request({ action: 'request', email: 'user@example.test' }))).json(),
    ).toEqual({ ok: true });
    expect(
      (await handler(request({ action: 'verify', email: 'user@example.test', code: '001234' })))
        .status,
    ).toBe(400);
    expect(dependencies.session).not.toHaveBeenCalled();
  });
});
