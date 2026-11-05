// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { createPilotPdfHandler } from '../supabase/functions/workspace-pilot-pdf/handler';

function request(fixture = 'a', origin = 'http://127.0.0.1:5182') {
  return new Request(`http://127.0.0.1/pilot?fixture=${fixture}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer synthetic', Origin: origin },
  });
}

async function pdf() {
  const encoded = await readFile(
    new URL('./fixtures/pilot-pdf/qa-aceite-2a-a.b64', import.meta.url),
    'utf8',
  );
  return Uint8Array.from(Buffer.from(encoded, 'base64')).buffer;
}

describe('download de homologação A/B', () => {
  it('entrega a fixture íntegra sem cache e revalida a mesma URL', async () => {
    const authorize = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(true);
    authorize.mockResolvedValue(false);
    const read = vi.fn(pdf);
    const serve = createPilotPdfHandler({ authorize, read });
    const response = await serve(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(await response.arrayBuffer()).toEqual(await pdf());
    expect((await serve(request())).status).toBe(403);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('recusa o download quando a sessão cai durante a leitura', async () => {
    const authorize = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const serve = createPilotPdfHandler({ authorize, read: pdf });
    const response = await serve(request());
    expect(response.status).toBe(403);
    expect((await response.arrayBuffer()).byteLength).toBe(0);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('recusa origem externa e caminhos fora das fixtures antes do Storage', async () => {
    const authorize = vi.fn().mockResolvedValue(true);
    const read = vi.fn(pdf);
    const serve = createPilotPdfHandler({ authorize, read });
    expect((await serve(request('a', 'https://example.test'))).status).toBe(403);
    expect((await serve(request('other.pdf'))).status).toBe(400);
    expect(authorize).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it('recusa conteúdo divergente', async () => {
    const serve = createPilotPdfHandler({
      authorize: async () => true,
      read: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    const response = await serve(request());
    expect(response.status).toBe(503);
    expect((await response.arrayBuffer()).byteLength).toBe(0);
  });
});
