import { z } from 'zod';
import {
  codeIssueResultSchema,
  codeSubjectSchema,
  createAccessHandler,
} from '../workspace-access/handler.ts';
import {
  createSessionExchange,
  issuedSessionSchema,
} from '../workspace-access/session-exchange.ts';

declare const Deno: {
  env: { get: (name: string) => string | undefined };
  serve: (handler: (request: Request) => Promise<Response>) => void;
};

const project = z
  .literal('https://kqtbfeeqbcllwvlkbrkq.supabase.co')
  .parse(Deno.env.get('SUPABASE_URL'));
const serviceKey = z.string().min(1).parse(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
const sendKey = z.string().min(1).parse(Deno.env.get('RESEND_API_KEY'));
const from = 'APP CALI RH <workspace@calirh.com>';
const material = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(serviceKey),
  'HKDF',
  false,
  ['deriveKey'],
);
const hmac = await crypto.subtle.deriveKey(
  {
    name: 'HKDF',
    hash: 'SHA-256',
    salt: new TextEncoder().encode(project),
    info: new TextEncoder().encode('cali-workspace-pilot:otp-hmac:v1'),
  },
  material,
  { name: 'HMAC', hash: 'SHA-256', length: 256 },
  false,
  ['sign'],
);

async function post(path: string, body: object, token = serviceKey) {
  const response = await fetch(project + path, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(4000),
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Profile': 'cali_workspace',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('Operação interna indisponível.');
  return response;
}

Deno.serve(
  createAccessHandler(
    {
      randomCode() {
        const values = new Uint32Array(1);
        do {
          crypto.getRandomValues(values);
        } while (values[0] >= 4_294_000_000);
        return String(values[0] % 1_000_000).padStart(6, '0');
      },
      async hash(email, code) {
        const digest = await crypto.subtle.sign(
          'HMAC',
          hmac,
          new TextEncoder().encode(`cali-workspace-pilot:${email}:${code}`),
        );
        return Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, '0'),
        ).join('');
      },
      async issue(email, hash) {
        const result = await post('/rest/v1/rpc/v2_issue_pilot_code', {
          p_email: email,
          p_hash: hash,
        });
        return codeIssueResultSchema.parse(await result.json());
      },
      async delivered(id, delivered) {
        await post('/rest/v1/rpc/v2_deliver_pilot_code', { p_id: id, p_delivered: delivered });
      },
      async consume(email, hash) {
        const result = await post('/rest/v1/rpc/v2_consume_pilot_code', {
          p_email: email,
          p_hash: hash,
        });
        return codeSubjectSchema.parse(await result.json());
      },
      async send(email, code, requestId) {
        // Só chega após o banco confirmar o e-mail registrado e elegível para A/B.
        const result = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(4000),
          headers: {
            Authorization: `Bearer ${sendKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': `cali-workspace-pilot/${requestId}`,
          },
          body: JSON.stringify({
            from,
            to: [email],
            subject: 'CALI Workspace V2 · Código de acesso de teste',
            text: `Seu código de teste é ${code}. Ele é válido por 10 minutos.`,
          }),
        });
        if (!result.ok) throw new Error('Entrega indisponível.');
      },
      session: createSessionExchange({
        async authenticate(email) {
          const generated = await post('/auth/v1/admin/generate_link', {
            type: 'magiclink',
            email,
          });
          const { hashed_token } = z
            .object({ hashed_token: z.string().min(1) })
            .parse(await generated.json());
          const verified = await post('/auth/v1/verify', {
            token_hash: hashed_token,
            type: 'email',
          });
          return issuedSessionSchema.parse(await verified.json());
        },
        async admit(authorizationId, sessionId) {
          const result = await post('/rest/v1/rpc/admit_workspace_session_v2', {
            p_authorization_id: authorizationId,
            p_session_id: sessionId,
          });
          return z.boolean().parse(await result.json());
        },
        async revoke(token) {
          await post('/auth/v1/logout?scope=local', {}, token);
        },
      }),
    },
    {
      origins: ['http://127.0.0.1:5181', 'http://127.0.0.1:5182'],
      hideDeliveryFailure: true,
    },
  ),
);
