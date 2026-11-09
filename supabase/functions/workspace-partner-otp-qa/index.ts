// Função descartável de homologação. Não usa credencial administrativa do Auth.
import { z } from 'zod';

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handle: (request: Request) => Promise<Response>) => void;
};

const project = 'https://kqtbfeeqbcllwvlkbrkq.supabase.co';
const origin = 'http://127.0.0.1:5183';
const headers = {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'content-type, x-cali-qa-ticket',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};
const encoder = new TextEncoder();
const message = 'Não foi possível confirmar o código de homologação.';

const hex = z.string().regex(/^[a-f0-9]{64}$/);
const configSchema = z.object({
  id: z.uuid(),
  serverKey: hex,
  ticketHash: hex,
  expiresAt: z.iso.datetime({ offset: true }),
  actor: z.uuid(),
  fixtureEmail: z.string().regex(/^cali-qa-staff-[a-f0-9-]{36}@example\.invalid$/),
  fixturePassword: z.string().min(32),
  recipient: z.email(),
});
const requestSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('request'), email: z.string() }),
  z.strictObject({
    action: z.literal('verify'),
    email: z.string(),
    code: z.string().regex(/^\d{8}$/),
  }),
]);
const sessionSchema = z.object({
  user: z.object({ id: z.uuid() }),
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
});

async function hash(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function newCode() {
  const sample = new Uint32Array(1);
  do crypto.getRandomValues(sample);
  while (sample[0] >= 4_200_000_000);
  return String(sample[0] % 100_000_000).padStart(8, '0');
}

async function handle(request: Request) {
  const fail = (status: number) => Response.json({ error: message }, { status, headers });
  if (request.headers.get('origin') !== origin) return fail(403);
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'POST') return fail(405);
  try {
    const key = Deno.env.get('SUPABASE_ANON_KEY');
    const sender = Deno.env.get('RESEND_API_KEY');
    const raw = Deno.env.get('CALI_PARTNER_OTP_QA');
    if (Deno.env.get('SUPABASE_URL') !== project || !key || !sender || !raw) return fail(503);
    const cfg = configSchema.parse(JSON.parse(raw));
    const ticket = request.headers.get('x-cali-qa-ticket');
    const expiry = Date.parse(cfg.expiresAt);
    if (
      !ticket ||
      !/^[a-f0-9]{64}$/.test(ticket) ||
      (await hash(ticket)) !== cfg.ticketHash ||
      !Number.isFinite(expiry) ||
      expiry <= Date.now() ||
      expiry > Date.now() + 25 * 60_000
    ) {
      return fail(403);
    }
    const input = await request.text();
    if (input.length > 512) return fail(400);
    const parsed = requestSchema.safeParse(JSON.parse(input));
    if (!parsed.success) return fail(400);
    const body = parsed.data;
    if (typeof body.email !== 'string' || body.email.trim().toLowerCase() !== cfg.recipient) {
      return fail(403);
    }

    async function step(action: 'issue' | 'delivered' | 'consume', code: string) {
      const response = await fetch(project + '/rest/v1/rpc/v2_partner_otp_qa', {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(8000),
        headers: {
          apikey: key ?? '',
          'Content-Profile': 'public',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_id: cfg.id,
          p_key: cfg.serverKey,
          p_action: action,
          p_code_hash: await hash(cfg.serverKey + ':' + code),
        }),
      });
      return response.ok && (await response.json()) === true;
    }

    if (body.action === 'request') {
      const code = newCode();
      if (!(await step('issue', code))) return fail(429);
      const sent = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(8000),
        headers: {
          Authorization: 'Bearer ' + sender,
          'Content-Type': 'application/json',
          'Idempotency-Key': 'cali-partner-otp-qa/' + cfg.id,
        },
        body: JSON.stringify({
          from: 'APP CALI RH <workspace@calirh.com>',
          to: [cfg.recipient],
          subject: '[TESTE] CALI Workspace · Código Partner',
          text: 'Seu código de homologação é ' + code + '. Use apenas na tela Partner. Uso único.',
        }),
      });
      if (!sent.ok || !(await step('delivered', code))) return fail(503);
      return Response.json({ accepted: true }, { headers });
    }

    if (!(await step('consume', body.code))) return fail(403);
    const auth = await fetch(project + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cfg.fixtureEmail, password: cfg.fixturePassword }),
    });
    if (!auth.ok) return fail(503);
    const session = sessionSchema.parse(await auth.json());
    if (session.user.id !== cfg.actor) return fail(503);
    return Response.json(
      {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      },
      { headers },
    );
  } catch {
    return fail(503);
  }
}

Deno.serve(handle);
