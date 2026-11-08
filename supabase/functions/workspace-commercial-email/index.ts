import { PDFDocument, PageSizes, StandardFonts } from 'pdf-lib';
import { z } from 'zod';

declare const Deno: {
  env: { get: (name: string) => string | undefined };
  serve: (handler: (request: Request) => Promise<Response>) => void;
};

const project = 'https://kqtbfeeqbcllwvlkbrkq.supabase.co';
const origin = 'http://127.0.0.1:5173';
const encoder = new TextEncoder();
const snapshotSchema = z.object({
  protocol: z.string().regex(/^CALI-QA-V2-[A-Z0-9-]{1,64}$/),
  version: z.number().int().positive(),
  total: z.number().positive(),
  package: z.enum(['ESSENCIAL', 'COMPLETO']),
  months: z.number().int().min(4).max(60),
  paymentTerms: z.string().max(2000).nullable(),
  publicNotes: z.string().max(4000).nullable(),
});
const jobSchema = z.object({ id: z.uuid(), sent: z.boolean(), snapshot: snapshotSchema });
const inputSchema = z.object({
  company: z.uuid(),
  proposal: z.uuid(),
  expected: z.iso.datetime({ offset: true }),
});
const cors = {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};

function required(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error('Configuração comercial indisponível.');
  return value;
}

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function makeToken(id: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode('commercial-pilot:' + id)));
}

async function proposalPdf(snapshot: z.infer<typeof snapshotSchema>) {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  let page = pdf.addPage(PageSizes.A4);
  let y = 780;

  const paragraphs = [
    'CALI | PROPOSTA DE HOMOLOGAÇÃO',
    `${snapshot.protocol} - Versão ${snapshot.version}`,
    `CALI Build ${snapshot.package} - ${snapshot.months} meses`,
    `Mensalidade: ${currency.format(snapshot.total).replace(/\s/g, ' ')}`,
    snapshot.paymentTerms ? 'Condições: ' + snapshot.paymentTerms : '',
    snapshot.publicNotes ? 'Observações: ' + snapshot.publicNotes : '',
  ];
  for (const paragraph of paragraphs) {
    const printable = paragraph.replace(/[^\x20-\x7e\xa0-\xff\n]/g, '?');
    for (const line of printable.split('\n').flatMap((text) => text.match(/.{1,75}/g) ?? [''])) {
      if (y < 64) {
        page = pdf.addPage(PageSizes.A4);
        y = 780;
      }
      page.drawText(line, { x: 52, y, size: 11, font });
      y -= 17;
    }
    y -= 12;
  }
  return pdf.saveAsBase64();
}

async function rpc(name: string, body: object, authorization: string, key: string) {
  const response = await fetch(`${project}/rest/v1/rpc/${name}`, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
    headers: {
      apikey: key,
      Authorization: authorization,
      'Content-Profile': 'cali_workspace',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('Operação comercial recusada.');
  return response.status === 204 ? null : response.json();
}

Deno.serve(async (request) => {
  if (request.headers.get('origin') !== origin) return new Response(null, { status: 403 });
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: cors });
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ') || Deno.env.get('SUPABASE_URL') !== project)
    return new Response(null, { status: 403, headers: cors });

  try {
    const input = inputSchema.parse(await request.json());
    const anon = required('SUPABASE_ANON_KEY');
    const service = required('SUPABASE_SERVICE_ROLE_KEY');
    const job = jobSchema.parse(
      await rpc(
        'v2_prepare_pilot_commercial_email',
        {
          p_company_id: input.company,
          p_proposal_id: input.proposal,
          p_expected: input.expected,
        },
        authorization,
        anon,
      ),
    );
    const token = await makeToken(job.id, service);
    const link = `${origin}/proposta-externa#${token}`;
    if (!job.sent) {
      const stored = z.string().parse(
        await rpc(
          'v2_stage_pilot_commercial_email',
          {
            p_id: job.id,
            p_pdf: await proposalPdf(job.snapshot),
            p_token_hash: hex(await crypto.subtle.digest('SHA-256', encoder.encode(token))),
          },
          `Bearer ${service}`,
          service,
        ),
      );
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
        headers: {
          Authorization: `Bearer ${required('RESEND_API_KEY')}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `cali-commercial-test-${job.id}`,
        },
        body: JSON.stringify({
          from: 'CALI Teste <onboarding@resend.dev>',
          to: ['delivered@resend.dev'],
          subject: `[TESTE] Proposta ${job.snapshot.protocol}`,
          text: `Proposta sintética. Confira e confirme o aceite em ${link}`,
          attachments: [
            { filename: `${job.snapshot.protocol}.pdf`, content: stored.replace(/\s/g, '') },
          ],
        }),
      });
      if (!response.ok) throw new Error('Simulador de e-mail recusou a entrega.');
      const provider = z.object({ id: z.uuid() }).parse(await response.json());
      await rpc(
        'v2_record_pilot_commercial_email',
        { p_id: job.id, p_provider: provider.id },
        `Bearer ${service}`,
        service,
      );
    }
    return Response.json({ testLink: link }, { headers: cors });
  } catch {
    return Response.json(
      { error: 'Não foi possível confirmar o envio de teste.' },
      { status: 400, headers: cors },
    );
  }
});
