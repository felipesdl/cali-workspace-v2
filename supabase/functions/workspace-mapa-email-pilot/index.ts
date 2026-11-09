import { z } from 'zod';
import { mapaReport } from '../../../src/api/admin/workspace/admin-read';
import { mapaReportPdf } from '../../../src/lib/people-map/mapa-report-pdf';

declare const Deno: {
  env: { get: (name: string) => string | undefined };
  serve: (handler: (request: Request) => Promise<Response>) => void;
};

const project = 'https://kqtbfeeqbcllwvlkbrkq.supabase.co';
const origin = 'http://127.0.0.1:5173';
const cors = {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};
const inputSchema = z.strictObject({ report: mapaReport });
const jobSchema = z.object({ id: z.uuid(), sent: z.boolean(), report: mapaReport });

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
  if (!response.ok) throw new Error('Operação do Mapa recusada.');
  return response.status === 204 ? null : response.json();
}

export async function handleMapaEmail(
  request: Request,
  getEnv: (name: string) => string | undefined,
) {
  if (request.headers.get('origin') !== origin) return new Response(null, { status: 403 });
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: cors });
  const authorization = request.headers.get('authorization');
  if (
    !authorization?.startsWith('Bearer ') ||
    getEnv('SUPABASE_URL') !== project ||
    getEnv('CALI_MAPA_EMAIL_PILOT_ENABLED') !== 'true'
  ) {
    return new Response(null, { status: 403, headers: cors });
  }
  const anon = getEnv('SUPABASE_ANON_KEY');
  const service = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const resend = getEnv('RESEND_API_KEY');
  if (!anon || !service || !resend) return new Response(null, { status: 503, headers: cors });

  try {
    const { report } = inputSchema.parse(await request.json());
    const job = jobSchema.parse(
      await rpc(
        'v2_prepare_pilot_mapa_email',
        {
          p_company_id: report.companyId,
          p_record_id: report.recordId,
          p_expected: report,
        },
        authorization,
        anon,
      ),
    );
    const protocol = z
      .string()
      .regex(/^CALI-QA-V2-MAPA-[A-Z0-9-]{1,64}$/)
      .parse(job.report.protocol);
    if (job.report.companyId !== report.companyId || job.report.recordId !== report.recordId) {
      throw new Error('Contexto do diagnóstico divergente.');
    }
    if (!job.sent) {
      const { blob, fileName } = await mapaReportPdf(job.report);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
        headers: {
          Authorization: `Bearer ${resend}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `cali-mapa-test-${job.id}`,
        },
        body: JSON.stringify({
          from: 'CALI Teste <onboarding@resend.dev>',
          to: ['delivered@resend.dev'],
          subject: `[TESTE] Diagnóstico ${protocol}`,
          text: 'Segue a devolutiva sintética do Mapa de People para homologação.',
          attachments: [{ filename: fileName, content: btoa(binary) }],
        }),
      });
      if (!response.ok) throw new Error('Simulador de e-mail recusou a entrega.');
      const provider = z.object({ id: z.uuid() }).parse(await response.json());
      await rpc(
        'v2_record_pilot_mapa_email',
        { p_id: job.id, p_provider: provider.id },
        `Bearer ${service}`,
        service,
      );
    }
    return Response.json({ accepted: true }, { headers: cors });
  } catch {
    return Response.json(
      { error: 'Não foi possível confirmar o envio de teste.' },
      { status: 400, headers: cors },
    );
  }
}

if (typeof Deno !== 'undefined') {
  Deno.serve((request) => handleMapaEmail(request, (name) => Deno.env.get(name)));
}
