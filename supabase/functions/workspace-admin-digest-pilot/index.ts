import { z } from 'zod';
import { digestJob, dispatchAdminDigest } from './dispatch';

declare const Deno: {
  env: { get: (name: string) => string | undefined };
  serve: (handler: (request: Request) => Promise<Response>) => void;
};

const project = 'https://kqtbfeeqbcllwvlkbrkq.supabase.co';
const headers = { 'Cache-Control': 'no-store' };
const encoder = new TextEncoder();

async function sameToken(value: string, expected: string) {
  const hash = (value: string) => crypto.subtle.digest('SHA-256', encoder.encode(value));
  const [left, right] = await Promise.all([hash(value), hash(expected)]);
  const expectedBytes = new Uint8Array(right);
  const mismatch = new Uint8Array(left).reduce(
    (diff, byte, index) => diff | (byte ^ expectedBytes[index]),
    0,
  );
  return mismatch === 0;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers });
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const workerToken = Deno.env.get('CALI_ADMIN_DIGEST_PILOT_TOKEN');
  const provided = request.headers.get('x-cali-digest-worker');
  if (
    !service ||
    Deno.env.get('SUPABASE_URL') !== project ||
    !workerToken ||
    workerToken.length < 32 ||
    !provided ||
    !(await sameToken(provided, workerToken))
  ) {
    return new Response(null, { status: 403, headers });
  }

  const serviceKey = service;
  async function rpc(name: string, body: object) {
    const response = await fetch(`${project}/rest/v1/rpc/${name}`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Profile': 'cali_workspace',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error('Operação de fila indisponível.');
    return response.json();
  }

  try {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) return new Response(null, { status: 503, headers });
    const job = digestJob.nullable().parse(await rpc('v2_claim_pilot_admin_digest', {}));
    const sent = await dispatchAdminDigest(job, apiKey, fetch, async (claim, provider) =>
      z
        .boolean()
        .parse(
          await rpc('v2_ack_pilot_admin_digest', { p_claim_id: claim, p_provider_id: provider }),
        ),
    );
    return Response.json({ sent }, { headers });
  } catch {
    return Response.json({ error: 'Resumo de teste sem confirmação.' }, { status: 502, headers });
  }
});
