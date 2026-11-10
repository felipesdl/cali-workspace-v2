import { z } from 'zod';
import { createDiscPdf, type DiscPdfInput } from '../_shared/disc-pdf.ts';
import { renderDiscEmail } from '../_shared/disc-email.ts';

const style = z.enum(['D', 'I', 'S', 'C']);
const score = z.object({ raw: z.number(), pct: z.number() });
const count = z.number().int().nonnegative();
const counts = z.record(style, count);
const scores = z.object({
  natural: z.record(style, score),
  natural6: z.record(style, score),
  pressure: z.record(style, score),
  adaptation: z.record(style, z.number()),
});
const signer = z.object({
  full_name: z.string(),
  job_title: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  signature_mode: z.string().nullable().optional(),
  signature_url: z.string().nullable().optional(),
  signature_style: z.string().nullable().optional(),
});
const reportSchema = z.object({
  id: z.uuid(),
  revision: z.number().int(),
  title: z.string(),
  organization: z.string(),
  goal: z.string(),
  note: z.string(),
  moment: z.string(),
  sector: z.string(),
  mode: z.enum(['unavailable', 'qualitative', 'quantitative']),
  sample_size: z.number().nullable(),
  distribution: z.record(style, z.number()).nullable(),
  quantitative: z
    .object({
      secondary: counts,
      mixed: count,
      bands: z.record(style, z.object({ low: count, mid: count, high: count })),
      pressure: z.object({
        stable: count,
        one: count,
        many: count,
        up: counts,
        down: counts,
      }),
    })
    .nullable()
    .optional(),
  qualitative: z.object({ dominant: z.string(), pressure: z.string() }),
  protocol: z.string().nullable(),
  approved_at: z.string().nullable(),
  signer: signer.nullable(),
});
const individualSchema = z.object({
  audience: z.enum(['respondent', 'evaluator']),
  title: z.string(),
  organization: z.string(),
  protocol: z.string(),
  personName: z.string(),
  primary: style,
  secondary: style,
  mixed: z.boolean(),
  createdAt: z.string(),
  scores: scores.optional(),
  signer: signer.nullable(),
});
const documentSchema = z.union([
  individualSchema,
  z.object({ audience: z.literal('management'), report: reportSchema }),
]);
const jobSchema = z.object({
  id: z.uuid(),
  kind: z.string(),
  recipient: z.email(),
  title: z.string(),
  organization: z.string(),
  name: z.string(),
  token: z.uuid().nullable(),
  deadline: z.string().nullable(),
  created_at: z.string(),
  payload: z.object({
    report: reportSchema.optional(),
    name: z.string().optional(),
    deadline: z.string().optional(),
    pending: z.number().optional(),
  }),
  respondent: individualSchema.nullable(),
});
const commandSchema = z.strictObject({
  action: z.enum(['document', 'scheduled']).optional(),
  campaignId: z.uuid().nullable().optional(),
  resultId: z.uuid().nullable().optional(),
});
const origins = new Set([
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5181',
  'http://127.0.0.1:5182',
]);
const baseHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  Vary: 'Origin',
};
export type DiscWorkerPorts = {
  authorize: (authorization: string) => Promise<boolean>;
  authorizeScheduler: (authorization: string) => Promise<boolean>;
  authorizeHook: (secret: string) => Promise<boolean>;
  document: (
    authorization: string,
    campaign: string | null,
    result: string | null,
  ) => Promise<z.infer<typeof documentSchema>>;
  validate: (id: string) => Promise<boolean>;
  claim: () => Promise<z.infer<typeof jobSchema> | null>;
  record: (
    id: string,
    state: 'sent' | 'failed',
    fields: { providerId?: string; error?: string },
  ) => Promise<void>;
  send: (input: {
    to: string;
    subject: string;
    html: string;
    text: string;
    key: string;
    attachment?: Uint8Array;
  }) => Promise<string>;
  readAsset: (url: string) => Promise<Uint8Array | undefined>;
};
function managementInput(report: z.infer<typeof reportSchema>): DiscPdfInput {
  if (report.mode === 'unavailable' || !report.protocol || !report.approved_at)
    throw new Error('Relatório não aprovado.');
  return {
    audience: 'management',
    title: report.title,
    organization: report.organization,
    protocol: report.protocol,
    mode: report.mode,
    sampleSize: report.sample_size,
    distribution: report.distribution,
    quantitative: report.quantitative,
    goal: report.goal,
    note: report.note,
    moment: report.moment,
    sector: report.sector,
    qualitative: report.qualitative,
    signer: report.signer,
    createdAt: report.approved_at,
  };
}
async function artifact(input: DiscPdfInput, ports: DiscWorkerPorts, photo?: string | null) {
  const avatar = photo ? await ports.readAsset(photo) : undefined;
  const signature = input.signer?.signature_url
    ? await ports.readAsset(input.signer.signature_url)
    : undefined;
  if (input.audience === 'management' && !avatar)
    throw new Error('Foto da assinatura indisponível.');
  return createDiscPdf({ ...input, avatar, signature });
}
export function createDiscHandler(ports: DiscWorkerPorts) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('Origin');
    const headers = {
      ...baseHeaders,
      ...(origin && origins.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
      'Access-Control-Allow-Headers': 'authorization,apikey,x-client-info,content-type',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
    };
    const json = (body: object, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    if (origin && !origins.has(origin)) return json({ error: 'Origem não autorizada.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json({ error: 'Método indisponível.' }, 405);
    const authorization = request.headers.get('Authorization') ?? '';
    const hook = request.headers.get('x-cali-disc-hook') ?? '';
    if (!authorization.startsWith('Bearer ')) return json({ error: 'Sessão necessária.' }, 401);
    try {
      const raw = await request.text();
      if (raw.length > 2000) return json({ error: 'Pedido excede o limite.' }, 400);
      const parsed = commandSchema.safeParse(JSON.parse(raw || '{}'));
      if (!parsed.success) return json({ error: 'Pedido inválido.' }, 400);
      const scheduled = parsed.data.action === 'scheduled';
      if (
        scheduled &&
        (origin || parsed.data.campaignId !== undefined || parsed.data.resultId !== undefined)
      )
        return json({ error: 'Pedido de agenda inválido.' }, 403);
      if (parsed.data.action === 'document') {
        if (!authorization.startsWith('Bearer ')) return json({ error: 'Sessão necessária.' }, 401);
        const doc = documentSchema.parse(
          await ports.document(
            authorization,
            parsed.data.campaignId ?? null,
            parsed.data.resultId ?? null,
          ),
        );
        const input = doc.audience === 'management' ? managementInput(doc.report) : doc;
        const photo =
          doc.audience === 'management' ? doc.report.signer?.avatar_url : doc.signer?.avatar_url;
        const bytes = await artifact(input, ports, photo);
        const current = documentSchema.parse(
          await ports.document(
            authorization,
            parsed.data.campaignId ?? null,
            parsed.data.resultId ?? null,
          ),
        );
        if (JSON.stringify(current) !== JSON.stringify(doc))
          throw new Error('Revisão alterada durante a geração.');
        return new Response(new Uint8Array(bytes), {
          headers: {
            ...headers,
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="CALI-perfil-homologacao.pdf"',
          },
        });
      }
      if (scheduled) {
        if (
          !hook ||
          !(await ports.authorizeScheduler(authorization)) ||
          !(await ports.authorizeHook(hook))
        )
          return json({ error: 'Agenda sem autorização vigente.' }, 403);
      } else if (!(await ports.authorize(authorization))) {
        return json({ error: 'Admin com MFA e aceite vigente necessário.' }, 403);
      }
      let processed = 0,
        failed = 0;
      const startedAt = Date.now();
      for (let index = 0; index < 5 && Date.now() - startedAt < 45000; index++) {
        if (scheduled && !(await ports.authorizeHook(hook))) break;
        const claimed = await ports.claim();
        if (!claimed) break;
        const job = jobSchema.parse(claimed);
        try {
          let attachment: Uint8Array | undefined;
          if (job.kind === 'respondent_pdf') {
            if (!job.respondent) throw new Error('Resultado individual ausente.');
            attachment = await artifact(job.respondent, ports, job.respondent.signer?.avatar_url);
          } else if (job.kind === 'gestao_pdf') {
            if (!job.payload.report) throw new Error('Gestão aprovada ausente.');
            attachment = await artifact(
              managementInput(job.payload.report),
              ports,
              job.payload.report.signer?.avatar_url,
            );
          }
          const url =
            job.kind === 'gestao_released'
              ? 'http://127.0.0.1:5181/cliente/perfil'
              : job.token
                ? `http://127.0.0.1:5181/disc/convite/${job.token}`
                : 'http://127.0.0.1:5173/admin/perfil';
          const deadline = job.deadline
            ? new Intl.DateTimeFormat('pt-BR', {
                dateStyle: 'long',
                timeStyle: 'short',
                timeZone: 'America/Sao_Paulo',
              }).format(new Date(job.deadline))
            : undefined;
          const email = renderDiscEmail({
            kind: job.kind,
            title: job.title,
            name: job.name,
            url,
            deadline,
            message:
              job.payload.pending === undefined
                ? undefined
                : `Participações pendentes: ${job.payload.pending}.`,
          });
          if (!(await ports.validate(job.id))) throw new Error('Contexto do envio alterado.');
          if (scheduled && !(await ports.authorizeHook(hook)))
            throw new Error('Agenda desativada durante o processamento.');
          const providerId = await ports.send({
            ...email,
            to: job.recipient,
            key: `cali-disc-${job.id}`,
            attachment,
          });
          await ports.record(job.id, 'sent', { providerId });
          processed++;
        } catch {
          await ports.record(job.id, 'failed', {
            error:
              'Envio não confirmado. Consulte o provedor antes de repetir fora da janela idempotente.',
          });
          failed++;
        }
      }
      return json({ processed, failed });
    } catch {
      return json({ error: 'Operação indisponível ou sem autorização.' }, 403);
    }
  };
}
export const discDocumentSchema = documentSchema;
export const discJobSchema = jobSchema;
