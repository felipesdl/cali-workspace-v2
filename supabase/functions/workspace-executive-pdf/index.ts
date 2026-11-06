import { createExecutivePdfHandler, readReportImage, type ReportPdfCommand } from './handler.ts';

declare const Deno: {
  env: { get: (name: string) => string | undefined };
  serve: (handler: (request: Request) => Promise<Response>) => void;
};

const project = Deno.env.get('SUPABASE_URL');
const anon = Deno.env.get('SUPABASE_ANON_KEY');
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (project !== 'https://kqtbfeeqbcllwvlkbrkq.supabase.co' || !anon || !service)
  throw new Error('Configuração do relatório piloto indisponível.');
const allowedOrigins = new Set([project, 'https://app.calirh.com']);

async function rpc(
  name: string,
  command: ReportPdfCommand,
  extras: object,
  authorization: string,
  key: string,
) {
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
    body: JSON.stringify({
      p_company_id: command.companyId,
      p_report_id: command.reportId,
      p_version: command.version,
      ...extras,
    }),
  });
  if (!response.ok) throw new Error('Operação de relatório recusada.');
  return response.json();
}

function base64(bytes: Uint8Array) {
  let output = '';
  for (let start = 0; start < bytes.length; start += 16384)
    output += String.fromCharCode(...bytes.subarray(start, start + 16384));
  return btoa(output);
}

Deno.serve(
  createExecutivePdfHandler({
    prepare: (authorization, command) =>
      rpc('v2_prepare_pilot_report_pdf', command, {}, authorization, anon),
    async store(command, ticket, bytes) {
      await rpc(
        'v2_store_generated_pilot_report_pdf',
        command,
        { p_ticket: ticket, p_pdf_base64: base64(bytes) },
        `Bearer ${service}`,
        service,
      );
    },
    readImage: (url) => readReportImage(url, allowedOrigins),
  }),
);
