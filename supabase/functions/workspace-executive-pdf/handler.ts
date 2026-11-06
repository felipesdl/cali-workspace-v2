import { z } from 'zod';
import { normalizeDiscImage } from '../_shared/disc-image.ts';
import { renderExecutivePdf, reportInputSchema } from './report-pdf.ts';

const commandSchema = z
  .object({
    companyId: z.uuid(),
    reportId: z.uuid(),
    version: z.number().int().positive().max(2147483647),
  })
  .strict();
export type ReportPdfCommand = z.infer<typeof commandSchema>;

const preparedSchema = z.object({ ticket: z.uuid(), input: reportInputSchema }).nullable();
const origins = new Set([
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5181',
  'http://127.0.0.1:5182',
]);
const maxAssetBytes = 3_000_000;

async function readLimited(response: Response) {
  if (!response.body || Number(response.headers.get('Content-Length')) > maxAssetBytes)
    throw new Error('Imagem acima do limite.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > maxAssetBytes) throw new Error('Imagem acima do limite.');
      chunks.push(chunk.value);
    }
  } finally {
    await reader.cancel();
  }
  const result = new Uint8Array(size);
  let position = 0;
  for (const chunk of chunks) {
    result.set(chunk, position);
    position += chunk.length;
  }
  return result;
}

export async function readReportImage(input: string, allowedOrigins: ReadonlySet<string>) {
  const url = new URL(input);
  if (url.protocol !== 'https:' || !allowedOrigins.has(url.origin) || url.username || url.password)
    throw new Error('Origem da imagem indisponível.');
  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
    redirect: 'error',
  });
  if (!response.ok) throw new Error('Imagem indisponível.');
  return normalizeDiscImage(
    await readLimited(response),
    response.headers.get('Content-Type') ?? '',
  );
}

type Ports = {
  prepare: (
    authorization: string,
    command: ReportPdfCommand,
  ) => Promise<z.input<typeof preparedSchema>>;
  store: (command: ReportPdfCommand, ticket: string, bytes: Uint8Array) => Promise<void>;
  readImage: (url: string) => Promise<Uint8Array>;
};

export function createExecutivePdfHandler(ports: Ports) {
  return async (request: Request) => {
    const origin = request.headers.get('Origin');
    const headers = new Headers({
      'Cache-Control': 'private, no-store',
      'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin',
    });
    if (origin && !origins.has(origin)) return new Response(null, { status: 403, headers });
    if (origin) headers.set('Access-Control-Allow-Origin', origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return new Response(null, { status: 405, headers });
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return new Response(null, { status: 401, headers });

    const raw = await request.json().catch(() => null);
    const command = commandSchema.safeParse(raw);
    if (!command.success)
      return Response.json(
        { message: 'Relatório ou revisão inválidos.' },
        { status: 400, headers },
      );
    let prepared;
    try {
      prepared = await ports.prepare(auth, command.data);
    } catch {
      return Response.json(
        { message: 'A revisão não está disponível para geração.' },
        { status: 403, headers },
      );
    }
    try {
      const result = preparedSchema.parse(prepared);
      if (result) {
        const { signer } = result.input;
        const [photo, signature] = await Promise.all([
          ports.readImage(signer.avatar_url),
          signer.signature_url ? ports.readImage(signer.signature_url) : undefined,
        ]);
        const bytes = await renderExecutivePdf(result.input, photo, signature);
        await ports.store(command.data, result.ticket, bytes);
      }
      return Response.json({ id: command.data.reportId }, { headers });
    } catch {
      return Response.json(
        { message: 'Não foi possível gerar o PDF. Confira a coleta, a foto e a assinatura.' },
        { status: 422, headers },
      );
    }
  };
}
