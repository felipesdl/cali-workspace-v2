// @vitest-environment node
import { PDFDocument } from 'pdf-lib';
import { afterEach, expect, it, vi } from 'vitest';
import { handleMapaEmail } from '../supabase/functions/workspace-mapa-email-pilot';

const project = 'https://kqtbfeeqbcllwvlkbrkq.supabase.co';
const origin = 'http://127.0.0.1:5173';
const jobId = '40000000-0000-4000-8000-000000000041';
const providerId = '40000000-0000-4000-8000-000000000042';
const report = {
  companyId: '9c5ab148-78b8-4410-9338-58c44222a5db',
  recordId: '40000000-0000-4000-8000-000000000043',
  version: 1,
  dimensions: [6, 8, 4, 8],
  subscores: null,
  score: 6.7,
  protocol: 'CALI-QA-V2-MAPA-TEST',
  createdAt: '2026-11-08T17:00:00Z',
  companyName: 'Empresa de teste',
  observations: [null, null, null, null],
  opinion: 'Parecer sintético.',
  recommendedService: 'CALI Full',
};
const env: Record<string, string> = {
  SUPABASE_URL: project,
  CALI_MAPA_EMAIL_PILOT_ENABLED: 'true',
  SUPABASE_ANON_KEY: 'test-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service',
  RESEND_API_KEY: 'test-resend',
};

function send(body: object = { report }, getEnv = (name: string) => env[name]) {
  return handleMapaEmail(
    new Request(origin, {
      method: 'POST',
      headers: { origin, authorization: 'Bearer test-admin' },
      body: JSON.stringify(body),
    }),
    getEnv,
  );
}

afterEach(() => vi.unstubAllGlobals());

it('repete o mesmo PDF e a mesma chave se a confirmação local falhar', async () => {
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ id: jobId, sent: false, report }))
    .mockResolvedValueOnce(Response.json({ id: providerId }))
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ id: jobId, sent: false, report }))
    .mockResolvedValueOnce(Response.json({ id: providerId }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(Response.json({ id: jobId, sent: true, report }));
  vi.stubGlobal('fetch', transport);

  expect((await send()).status).toBe(400);
  expect(await (await send()).json()).toEqual({ accepted: true });
  expect(await (await send()).json()).toEqual({ accepted: true });
  const deliveries = transport.mock.calls.filter(
    ([url]) => url === 'https://api.resend.com/emails',
  );
  expect(deliveries).toHaveLength(2);
  const first = deliveries[0][1];
  expect(first?.body).toBe(deliveries[1][1]?.body);
  expect(first?.headers).toEqual(deliveries[1][1]?.headers);
  expect(first?.headers).toMatchObject({ 'Idempotency-Key': `cali-mapa-test-${jobId}` });
  expect(typeof first?.body).toBe('string');
  const payload: { to: string[]; attachments: { content: string; filename: string }[] } =
    JSON.parse(String(first?.body));
  expect(payload.to).toEqual(['delivered@resend.dev']);
  expect(payload.attachments[0].filename).toBe(report.protocol + '.pdf');
  expect((await PDFDocument.load(payload.attachments[0].content)).getTitle()).toBe(
    'Diagnóstico do Mapa de People',
  );
  expect(transport.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer test-admin' });
  expect(transport.mock.calls[2][1]?.headers).toMatchObject({
    Authorization: 'Bearer test-service',
  });
});

it('não consulta o provedor se o piloto estiver desligado, se houver destinatário livre ou se o banco recusar', async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 403 }));
  vi.stubGlobal('fetch', transport);
  expect((await send({ report }, () => '')).status).toBe(403);
  expect((await send({ report, to: 'outro@example.invalid' })).status).toBe(400);
  expect(transport).not.toHaveBeenCalled();
  expect((await send()).status).toBe(400);
  expect(transport).toHaveBeenCalledTimes(1);
  expect(transport.mock.calls[0][0]).toBe(project + '/rest/v1/rpc/v2_prepare_pilot_mapa_email');
});
