import { describe, expect, it, vi } from 'vitest';
import { createMockHttpClient } from '../src/mocks/http/client';

describe('transporte sem rede', () => {
  it.each([
    { url: 'https://example.supabase.co/rest/v1/companies' },
    { url: '//api.example.test/companies' },
    { url: '/companies', baseURL: 'https://api.example.test' },
    { url: '/../companies' },
    { url: '/companies', adapter: 'fetch' },
  ])('recusa destino ou transporte alternativo: %j', async (config) => {
    const adapter = vi.fn();
    const client = createMockHttpClient(adapter);
    await expect(client.request(config)).rejects.toThrow('Destino não permitido');
    expect(adapter).not.toHaveBeenCalled();
  });

  it('não executa adapter para requisição já cancelada', async () => {
    const adapter = vi.fn();
    const client = createMockHttpClient(adapter);
    const controller = new AbortController();
    controller.abort();
    await expect(client.get('/companies', { signal: controller.signal })).rejects.toThrow();
    expect(adapter).not.toHaveBeenCalled();
  });
});
