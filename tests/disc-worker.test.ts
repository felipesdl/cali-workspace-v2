// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import { normalizeDiscImage } from '../supabase/functions/_shared/disc-image';
import {
  createDiscHandler,
  discDocumentSchema,
  type DiscWorkerPorts,
  discJobSchema,
} from '../supabase/functions/workspace-disc-pilot/handler';

function fixture() {
  const ports: DiscWorkerPorts = {
    authorize: vi.fn(async () => true),
    authorizeHook: vi.fn(async () => false),
    document: vi.fn(async () => {
      throw new Error('Não autorizado');
    }),
    validate: vi.fn(async () => true),
    claim: vi.fn(async () => null),
    record: vi.fn(async () => {}),
    send: vi.fn(async () => 'provider-qa'),
    readAsset: vi.fn(async () => undefined),
  };
  return { ports, handler: createDiscHandler(ports) };
}
const request = (
  body: object = {},
  headers: Record<string, string> = { Authorization: 'Bearer synthetic-session' },
) =>
  new Request('https://example.invalid/functions/v1/workspace-disc-pilot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
describe('worker DISC por público e confirmação do provedor', () => {
  it('recusa acesso anônimo e Admin não autorizado sem reservar envios', async () => {
    const { ports, handler } = fixture();
    expect(
      (await handler(new Request('https://example.invalid', { method: 'POST', body: '{}' })))
        .status,
    ).toBe(401);
    vi.mocked(ports.authorize).mockResolvedValue(false);
    expect((await handler(request())).status).toBe(403);
    expect(ports.claim).not.toHaveBeenCalled();
  });
  it('token interno do agendamento não concede leitura de PDF', async () => {
    const { ports, handler } = fixture();
    vi.mocked(ports.authorizeHook).mockResolvedValue(true);
    const response = await handler(
      new Request('https://example.invalid', {
        method: 'POST',
        headers: { 'x-cali-disc-hook': 'synthetic-hook' },
        body: JSON.stringify({
          action: 'document',
          resultId: '00000000-0000-4000-8000-000000000001',
        }),
      }),
    );
    expect(response.status).toBe(401);
    expect(ports.document).not.toHaveBeenCalled();
  });
  it('mapeia os agregados quantitativos de gestão até o PDF servido', async () => {
    const { ports, handler } = fixture();
    const quantitative = {
      secondary: { D: 2, I: 5, S: 3, C: 5 },
      mixed: 4,
      bands: {
        D: { low: 2, mid: 5, high: 8 },
        I: { low: 4, mid: 6, high: 5 },
        S: { low: 3, mid: 8, high: 4 },
        C: { low: 7, mid: 5, high: 3 },
      },
      pressure: {
        stable: 6,
        one: 7,
        many: 2,
        up: { D: 3, I: 4, S: 1, C: 0 },
        down: { D: 0, I: 1, S: 4, C: 3 },
      },
    };
    const document = discDocumentSchema.parse({
      audience: 'management',
      report: {
        id: '00000000-0000-4000-8000-000000000010',
        revision: 3,
        title: 'Homologação sintética',
        organization: 'Empresa sintética',
        goal: 'Melhorar a cooperação entre áreas.',
        note: 'Acordar responsabilidades e acompanhar os avanços.',
        moment: '',
        sector: '',
        mode: 'quantitative',
        sample_size: 15,
        distribution: { D: 6, I: 4, S: 3, C: 2 },
        quantitative,
        qualitative: { dominant: '', pressure: '' },
        protocol: 'CALI-GESTAO-2026-000010',
        approved_at: '2026-11-05T12:00:00.000Z',
        signer: {
          full_name: 'Assinante sintética',
          avatar_url: 'https://app.calirh.com/synthetic-avatar.png',
        },
      },
    });
    vi.mocked(ports.document).mockResolvedValue(document);
    const webp = new Uint8Array(
      await readFile(new URL('./fixtures/disc-synthetic.webp', import.meta.url)),
    );
    vi.mocked(ports.readAsset).mockResolvedValue(await normalizeDiscImage(webp, 'image/webp'));

    const response = await handler(
      request({
        action: 'document',
        campaignId: '00000000-0000-4000-8000-000000000010',
      }),
    );
    expect(response.status).toBe(200);
    const pdf = await PDFDocument.load(await response.arrayBuffer());
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });
  it('marca como enviado somente após retorno do provedor e usa chave estável', async () => {
    const { ports, handler } = fixture();
    const job = discJobSchema.parse({
      id: '00000000-0000-4000-8000-000000000001',
      kind: 'invite',
      recipient: 'qa@example.invalid',
      title: '[TESTE V2] Campanha',
      organization: 'Empresa sintética',
      name: 'Pessoa sintética',
      token: '00000000-0000-4000-8000-000000000002',
      deadline: '2026-11-12T02:59:00Z',
      created_at: '2026-11-05T12:00:00Z',
      payload: {},
      respondent: null,
    });
    vi.mocked(ports.claim).mockResolvedValueOnce(job).mockResolvedValueOnce(null);
    const response = await handler(request());
    expect(await response.json()).toEqual({ processed: 1, failed: 0 });
    expect(ports.send).toHaveBeenCalledWith(
      expect.objectContaining({ key: `cali-disc-${job.id}`, to: 'qa@example.invalid' }),
    );
    expect(ports.record).toHaveBeenCalledWith(job.id, 'sent', { providerId: 'provider-qa' });
  });
  it('falha no provedor não fabrica entrega e origem externa não processa fila', async () => {
    const { ports, handler } = fixture();
    const job = discJobSchema.parse({
      id: '00000000-0000-4000-8000-000000000001',
      kind: 'invite',
      recipient: 'qa@example.invalid',
      title: '[TESTE V2]',
      organization: 'Empresa sintética',
      name: 'Pessoa sintética',
      token: '00000000-0000-4000-8000-000000000002',
      deadline: null,
      created_at: '2026-11-05T12:00:00Z',
      payload: {},
      respondent: null,
    });
    vi.mocked(ports.claim).mockResolvedValueOnce(job).mockResolvedValueOnce(null);
    vi.mocked(ports.send).mockRejectedValueOnce(new Error('provider failed'));
    expect(await (await handler(request())).json()).toEqual({ processed: 0, failed: 1 });
    expect(ports.record).toHaveBeenCalledWith(
      job.id,
      'failed',
      expect.objectContaining({ error: expect.any(String) }),
    );
    expect(
      (
        await handler(
          request(
            {},
            { Authorization: 'Bearer synthetic-session', Origin: 'https://outside.invalid' },
          ),
        )
      ).status,
    ).toBe(403);
  });
});
