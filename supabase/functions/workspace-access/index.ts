import { z } from 'zod';
import { createAccessHandler, codeIssueResultSchema, codeSubjectSchema } from './handler.ts';

// Interface mínima do runtime. O bundle é typechecked localmente e executado no Edge local.
declare const Deno: {
  env: { get: (name: string) => string | undefined };
  serve: (handler: (request: Request) => Promise<Response>) => void;
};
const internalApi = z
  .enum(['http://kong:8000', 'http://supabase_kong_cali-workspace-v2-local:8000'])
  .parse(Deno.env.get('SUPABASE_URL'));
const serviceKey = z.string().min(1).parse(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

async function api(path: string, body: object) {
  const response = await fetch(`${internalApi}${path}`, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'Content-Profile': 'cali_workspace',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('Falha interna no acesso local.');
  return response;
}
async function rpc(name: string, body: object) {
  return (await api(`/rest/v1/rpc/${name}`, body)).json();
}
const hmac = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(serviceKey),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign'],
);

Deno.serve(
  createAccessHandler({
    randomCode() {
      // Rejection sampling evita viés do módulo sobre 32 bits.
      const values = new Uint32Array(1);
      do {
        crypto.getRandomValues(values);
      } while (values[0] >= 4_294_000_000);
      return String(values[0] % 1_000_000).padStart(6, '0');
    },
    async hash(email, code) {
      const signed = await crypto.subtle.sign(
        'HMAC',
        hmac,
        new TextEncoder().encode(`cali-workspace-v2:access-code:${email}:${code}`),
      );
      return [...new Uint8Array(signed)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    },
    async issue(email, hash) {
      return codeIssueResultSchema.parse(
        await rpc('issue_workspace_code', { p_email: email, p_hash: hash }),
      );
    },
    async delivered(id, delivered) {
      await api('/rest/v1/rpc/deliver_workspace_code', { p_id: id, p_delivered: delivered });
    },
    async consume(email, hash) {
      return codeSubjectSchema.parse(
        await rpc('consume_workspace_code', { p_email: email, p_hash: hash }),
      );
    },
    async send(email, code) {
      const response = await fetch(
        'http://supabase_inbucket_cali-workspace-v2-local:8025/api/v1/send',
        {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(5000),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            From: { Email: 'workspace@example.test', Name: 'CALI laboratório' },
            To: [{ Email: email }],
            Subject: 'CALI laboratório · Código de acesso',
            Text: `Seu código de teste é ${code}. Válido por 10 minutos. Mensagem exclusiva do laboratório local.`,
          }),
        },
      );
      if (!response.ok) throw new Error('Captura local indisponível.');
    },
    async token(email) {
      const response = await api('/auth/v1/admin/generate_link', { type: 'magiclink', email });
      return z.object({ hashed_token: z.string().min(1) }).parse(await response.json())
        .hashed_token;
    },
  }),
);
