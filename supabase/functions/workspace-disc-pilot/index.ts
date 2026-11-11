import { normalizeDiscImage } from '../_shared/disc-image.ts';
import { z } from 'zod';
import { createDiscHandler, discDocumentSchema, discJobSchema } from './handler.ts';
import { matchesSchedulerBearer } from './scheduler-auth.ts';

declare const Deno: {
  env: { get: (name: string) => string | undefined };
  serve: (handler: (request: Request) => Promise<Response>) => void;
};
const project = Deno.env.get('SUPABASE_URL');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const resendKey = Deno.env.get('RESEND_API_KEY');
const schedulerBearerSha256 = Deno.env.get('CALI_DISC_SCHEDULER_BEARER_SHA256') ?? '';
const production = 'https://kqtbfeeqbcllwvlkbrkq.supabase.co';
const previewOrigin = Deno.env.get('CALI_PREVIEW_ORIGIN');
const preview =
  previewOrigin === undefined
    ? undefined
    : {
        origin: z
          .string()
          .regex(/^https:\/\/[a-z0-9-]+\.vercel\.app$/)
          .parse(previewOrigin),
        recipients: new Set(
          z
            .array(z.email())
            .min(1)
            .parse(
              Deno.env
                .get('CALI_DISC_TEST_RECIPIENTS')
                ?.split(',')
                .map((email) => email.trim().toLowerCase()),
            ),
        ),
      };
if (
  !project ||
  !anonKey ||
  !serviceKey ||
  !resendKey ||
  (preview
    ? project === production || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(project)
    : project !== production)
)
  throw new Error('Configuração DISC do piloto indisponível.');
const url = project;
const publicKey = anonKey;
const privateKey = serviceKey;
async function rpc(name: string, body: object, authorization: string, key: string) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
    headers: {
      apikey: key,
      Authorization: authorization,
      'Content-Type': 'application/json',
      'Content-Profile': 'cali_workspace',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('Operação DISC recusada.');
  return response.json();
}
function base64(bytes: Uint8Array) {
  let value = '';
  for (let start = 0; start < bytes.length; start += 16384)
    value += String.fromCharCode(...bytes.subarray(start, start + 16384));
  return btoa(value);
}
Deno.serve(
  createDiscHandler(
    {
      authorizeScheduler: (authorization) =>
        matchesSchedulerBearer(authorization, schedulerBearerSha256),
      async authorize(authorization) {
        try {
          await rpc('v2_disc_admin', { p_campaign: null }, authorization, publicKey);
          return true;
        } catch {
          return false;
        }
      },
      async authorizeHook(secret) {
        return (
          (await rpc(
            'v2_disc_worker',
            { p_action: 'authorize_hook', p_fields: { secret } },
            `Bearer ${privateKey}`,
            privateKey,
          )) === true
        );
      },
      async document(authorization, campaign, result) {
        return discDocumentSchema.parse(
          await rpc(
            'v2_disc_document',
            { p_campaign: campaign, p_result: result },
            authorization,
            publicKey,
          ),
        );
      },
      async validate(id, legacyLease) {
        return (
          (await rpc(
            legacyLease ? 'v2_disc_legacy_delivery' : 'v2_disc_worker',
            {
              p_action: 'validate',
              p_job: id,
              ...(legacyLease && { p_fields: { lease: legacyLease } }),
            },
            `Bearer ${privateKey}`,
            privateKey,
          )) === true
        );
      },
      async claim() {
        const data = await rpc(
          'v2_disc_worker',
          { p_action: 'claim' },
          `Bearer ${privateKey}`,
          privateKey,
        );
        if (data !== null) return discJobSchema.parse(data);
        if (!preview) return null;
        const legacy = await rpc(
          'v2_disc_legacy_delivery',
          { p_action: 'claim' },
          `Bearer ${privateKey}`,
          privateKey,
        );
        return legacy === null
          ? null
          : discJobSchema.extend({ legacyLease: z.uuid() }).parse(legacy);
      },
      async record(id, state, fields, legacyLease) {
        await rpc(
          legacyLease ? 'v2_disc_legacy_delivery' : 'v2_disc_worker',
          {
            p_action: state,
            p_job: id,
            p_fields: { ...fields, ...(legacyLease && { lease: legacyLease }) },
          },
          `Bearer ${privateKey}`,
          privateKey,
        );
      },
      async readAsset(input) {
        const asset = new URL(input);
        if (
          asset.protocol !== 'https:' ||
          ![url, preview?.origin ?? 'https://app.calirh.com'].includes(asset.origin) ||
          asset.username ||
          asset.password
        )
          throw new Error('Origem do arquivo de assinatura recusada.');
        const response = await fetch(asset, {
          redirect: 'error',
          cache: 'no-store',
          signal: AbortSignal.timeout(8000),
        });
        const mime = response.headers.get('Content-Type') ?? '';
        if (
          !response.ok ||
          !['image/png', 'image/jpeg', 'image/webp'].some((value) => mime.startsWith(value))
        )
          throw new Error('Foto ou assinatura indisponível.');
        if (Number(response.headers.get('Content-Length') ?? 0) > 3000000)
          throw new Error('Imagem excede limite.');
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length > 3000000) throw new Error('Imagem excede limite.');
        return normalizeDiscImage(bytes, mime);
      },
      async send(input) {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': input.key,
          },
          body: JSON.stringify({
            from: 'CALI RH <workspace@calirh.com>',
            reply_to: 'nao-responda@calirh.com',
            to: [input.to],
            subject: input.subject,
            html: input.html,
            text: input.text,
            ...(input.attachment
              ? {
                  attachments: [
                    { filename: 'CALI-perfil-homologacao.pdf', content: base64(input.attachment) },
                  ],
                }
              : {}),
          }),
        });
        if (!response.ok) throw new Error('Provedor não confirmou envio.');
        return z.object({ id: z.string().min(1) }).parse(await response.json()).id;
      },
    },
    preview,
  ),
);
