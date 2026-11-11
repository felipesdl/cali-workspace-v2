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
  .string()
  .regex(/^https:\/\/[a-z0-9-]+\.supabase\.co$/)
  .refine((url) => url !== 'https://kqtbfeeqbcllwvlkbrkq.supabase.co')
  .parse(Deno.env.get('SUPABASE_URL'));
const origin = z
  .string()
  .regex(/^https:\/\/[a-z0-9-]+\.vercel\.app$/)
  .parse(Deno.env.get('CALI_PREVIEW_ORIGIN'));
const service = z.string().min(1).parse(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
const resend = z.string().min(1).parse(Deno.env.get('RESEND_API_KEY'));
const recipients = new Set(
  z
    .array(z.email())
    .min(1)
    .parse(
      Deno.env
        .get('CALI_PREVIEW_ACCESS_RECIPIENTS')
        ?.split(',')
        .map((email) => email.trim().toLowerCase()),
    ),
);

const encoder = new TextEncoder();
const hmac = await crypto.subtle.importKey(
  'raw',
  encoder.encode(service),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign'],
);

async function post(path: string, body: object, token = service) {
  const result = await fetch(project + path, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
    headers: {
      apikey: service,
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Content-Profile': 'cali_workspace',
    },
    body: JSON.stringify(body),
  });
  if (!result.ok) throw new Error('Acesso de homologação indisponível.');
  return result;
}
const codeRpc = '/rest/v1/rpc/v2_preview_access_code';

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
          encoder.encode(`cali-preview:access-code:${email}:${code}`),
        );
        return Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, '0'),
        ).join('');
      },
      async issue(email, hash) {
        if (!recipients.has(email)) return { status: 'unavailable' };
        return codeIssueResultSchema.parse(
          await (await post(codeRpc, { p_action: 'issue', p_email: email, p_hash: hash })).json(),
        );
      },
      async delivered(id, delivered) {
        await post(codeRpc, { p_action: 'delivery', p_id: id, p_delivered: delivered });
      },
      async consume(email, hash) {
        if (!recipients.has(email)) return null;
        return codeSubjectSchema.parse(
          await (await post(codeRpc, { p_action: 'consume', p_email: email, p_hash: hash })).json(),
        );
      },
      async send(email, code, requestId) {
        const result = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(5000),
          headers: {
            Authorization: 'Bearer ' + resend,
            'Content-Type': 'application/json',
            'Idempotency-Key': `cali-preview/access/${requestId}`,
          },
          body: JSON.stringify({
            from: 'CALI Workspace <workspace@calirh.com>',
            to: [email],
            subject: 'CALI Workspace · Código de homologação',
            text: `Seu código é ${code}. Válido por 10 minutos. Continue em ${origin}/acesso.`,
          }),
        });
        if (!result.ok) throw new Error('Entrega do código indisponível.');
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
    { origins: [origin], hideDeliveryFailure: true },
  ),
);
