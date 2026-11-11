// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { normalizeDiscImage } from '../supabase/functions/_shared/disc-image';
import { matchesSchedulerBearer } from '../supabase/functions/workspace-disc-pilot/scheduler-auth';
import {
  createDiscHandler,
  discDocumentSchema,
  type DiscWorkerPorts,
  discJobSchema,
} from '../supabase/functions/workspace-disc-pilot/handler';

function fixture() {
  const ports: DiscWorkerPorts = {
    authorize: vi.fn(async () => true),
    authorizeScheduler: vi.fn(async () => false),
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
  it('restringe origem e destinatários no preview e mantém o scheduler desligado', async () => {
    const { ports } = fixture();
    const origin = 'https://cali-qa.vercel.app';
    const handler = createDiscHandler(ports, {
      origin,
      recipients: new Set(['approved@example.test']),
    });
    const headers = { Authorization: 'Bearer synthetic-session', Origin: origin };
    expect(
      (await handler(request({}, { ...headers, Origin: 'https://other.vercel.app' }))).status,
    ).toBe(403);
    expect((await handler(request({ action: 'scheduled' }))).status).toBe(403);
    const invite = scheduledInvite();
    vi.mocked(ports.claim)
      .mockResolvedValueOnce(invite)
      .mockResolvedValueOnce({
        ...invite,
        id: '10000000-0000-4000-8000-000000000008',
        recipient: 'approved@example.test',
      });
    const response = await handler(request({}, headers));
    expect(await response.json()).toEqual({ processed: 1, failed: 1 });
    expect(response.headers.get('access-control-allow-origin')).toBe(origin);
    expect(ports.send).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        to: 'approved@example.test',
        html: expect.stringContaining(`${origin}/disc/convite/${invite.token}`),
      }),
    );
  });

  it('entrega PDF privado legado e registra o recibo na reserva que gerou o envio', async () => {
    const { ports } = fixture();
    const legacyLease = '10000000-0000-4000-8000-000000000009';
    const job = discJobSchema.parse({
      ...scheduledInvite(),
      kind: 'respondent_pdf',
      legacyLease,
      token: null,
      respondent: {
        audience: 'respondent',
        title: 'Perfil legado',
        organization: 'Empresa sintética',
        protocol: 'DISC-TESTE',
        personName: 'Pessoa sintética',
        primary: 'D',
        secondary: 'I',
        mixed: false,
        createdAt: '2026-11-11T12:00:00Z',
        signer: null,
      },
    });
    const origin = 'https://cali-qa.vercel.app';
    const handler = createDiscHandler(ports, { origin, recipients: new Set([job.recipient]) });
    vi.mocked(ports.claim).mockResolvedValueOnce(job);
    const response = await handler(
      request({}, { Origin: origin, Authorization: 'Bearer session-fixture' }),
    );

    expect(await response.json()).toEqual({ processed: 1, failed: 0 });
    expect(ports.validate).toHaveBeenCalledWith(job.id, legacyLease);
    expect(ports.record).toHaveBeenCalledWith(
      job.id,
      'sent',
      { providerId: 'provider-qa' },
      legacyLease,
    );
    expect(ports.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: job.recipient,
        key: `cali-disc-${job.id}`,
        attachment: expect.any(Uint8Array),
      }),
    );
    expect(vi.mocked(ports.send).mock.calls[0][0].html).not.toContain('/perfil/relatorio/');
  });

  it('exige o JWT de serviço exato, sem aceitar chave sb_secret ou token de sessão', async () => {
    const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
    const jwt = 'machine.payload.signature';
    const digest = sha256(jwt);
    expect(await matchesSchedulerBearer(`Bearer ${jwt}`, digest)).toBe(true);
    expect(await matchesSchedulerBearer('Bearer user.payload.signature', digest)).toBe(false);
    expect(
      await matchesSchedulerBearer('Bearer sb_secret_fixture', sha256('sb_secret_fixture')),
    ).toBe(false);
    expect(await matchesSchedulerBearer(jwt, digest)).toBe(false);
    expect(await matchesSchedulerBearer(`Bearer ${jwt}`, '')).toBe(false);
  });

  it('separa agenda da sessão Admin, exige hook vigente e recusa origem do navegador', async () => {
    const { ports, handler } = fixture();
    const headers = {
      Authorization: 'Bearer machine.payload.signature',
      'x-cali-disc-hook': 'synthetic-hook',
    };
    expect((await handler(request({ action: 'scheduled' }, headers))).status).toBe(403);
    vi.mocked(ports.authorizeScheduler).mockResolvedValue(true);
    expect((await handler(request({ action: 'scheduled' }, headers))).status).toBe(403);
    vi.mocked(ports.authorizeHook).mockResolvedValue(true);
    expect(
      (
        await handler(
          request({ action: 'scheduled' }, { ...headers, Origin: 'http://127.0.0.1:5173' }),
        )
      ).status,
    ).toBe(403);
    expect(
      (await handler(request({ action: 'scheduled', campaignId: null }, headers))).status,
    ).toBe(403);
    expect(
      (await handler(request({ action: 'scheduled', now: '2026-11-05' }, headers))).status,
    ).toBe(400);
    expect(ports.claim).not.toHaveBeenCalled();
    expect(ports.authorize).not.toHaveBeenCalled();
    expect(await (await handler(request({ action: 'scheduled' }, headers))).json()).toEqual({
      processed: 0,
      failed: 0,
    });
  });

  it('desativação entre reserva e envio impede chamada ao provedor', async () => {
    const { ports, handler } = fixture();
    vi.mocked(ports.authorizeScheduler).mockResolvedValue(true);
    vi.mocked(ports.authorizeHook)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);
    vi.mocked(ports.claim).mockResolvedValueOnce(scheduledInvite());
    const response = await handler(
      request(
        { action: 'scheduled' },
        {
          Authorization: 'Bearer machine.payload.signature',
          'x-cali-disc-hook': 'synthetic-hook',
        },
      ),
    );
    expect(await response.json()).toEqual({ processed: 0, failed: 1 });
    expect(ports.send).not.toHaveBeenCalled();
    expect(ports.record).toHaveBeenCalledWith(
      scheduledInvite().id,
      'failed',
      expect.objectContaining({ error: expect.any(String) }),
    );
  });

  it('entrega agendada mantém chave de tarefa e encerra lote no orçamento de tempo', async () => {
    const { ports, handler } = fixture();
    let now = 0;
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now);
    vi.mocked(ports.authorizeScheduler).mockResolvedValue(true);
    vi.mocked(ports.authorizeHook).mockResolvedValue(true);
    vi.mocked(ports.claim).mockResolvedValue(scheduledInvite());
    vi.mocked(ports.send).mockImplementation(async () => {
      now = 60000;
      return 'provider-qa';
    });
    try {
      expect(
        await (
          await handler(
            request(
              { action: 'scheduled' },
              {
                Authorization: 'Bearer machine.payload.signature',
                'x-cali-disc-hook': 'synthetic-hook',
              },
            ),
          )
        ).json(),
      ).toEqual({ processed: 1, failed: 0 });
      expect(ports.claim).toHaveBeenCalledTimes(1);
      expect(ports.send).toHaveBeenCalledWith(
        expect.objectContaining({ key: `cali-disc-${scheduledInvite().id}` }),
      );
      expect(ports.record).toHaveBeenCalledWith(scheduledInvite().id, 'sent', {
        providerId: 'provider-qa',
      });
      expect(ports.authorize).not.toHaveBeenCalled();
    } finally {
      clock.mockRestore();
    }
  });

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

function scheduledInvite() {
  return discJobSchema.parse({
    id: '00000000-0000-4000-8000-000000000001',
    kind: 'invite',
    recipient: 'qa@synthetic.invalid',
    title: '[TESTE V2] Agenda',
    organization: 'Empresa sintética',
    name: 'Pessoa sintética',
    token: '00000000-0000-4000-8000-000000000002',
    deadline: '2026-11-12T02:59:00Z',
    created_at: '2026-11-05T12:00:00Z',
    payload: {},
    respondent: null,
  });
}
