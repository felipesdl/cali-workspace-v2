import { z } from 'zod';
import { loginSubjectSchema } from './session-exchange.ts';
import {
  requestAccessCodeSchema,
  verifyAccessCodeSchema,
} from '../../../src/api/access/schemas.ts';

export const codeIssueResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('issued'), id: z.uuid() }),
  z.object({ status: z.literal('unavailable') }),
  z.object({ status: z.literal('limited') }),
]);
export const codeSubjectSchema = loginSubjectSchema.nullable();
type Issue = z.infer<typeof codeIssueResultSchema>;
export type AccessPorts = {
  randomCode: () => string;
  hash: (email: string, code: string) => Promise<string>;
  issue: (email: string, hash: string) => Promise<Issue>;
  delivered: (id: string, delivered: boolean) => Promise<void>;
  consume: (email: string, hash: string) => Promise<z.infer<typeof codeSubjectSchema>>;
  send: (email: string, code: string, requestId: string, origin: string) => Promise<void>;
  session: (subject: z.infer<typeof loginSubjectSchema>) => Promise<{
    access_token: string;
    refresh_token: string;
  }>;
};

const accessRequest = z.discriminatedUnion('action', [
  requestAccessCodeSchema,
  verifyAccessCodeSchema,
]);
export function createAccessHandler(
  ports: AccessPorts,
  options: { origins: readonly string[]; hideDeliveryFailure?: boolean } = {
    origins: ['http://127.0.0.1:5173'],
  },
) {
  return async (request: Request) => {
    const origin = request.headers.get('origin') ?? '';
    const allowed = options.origins.includes(origin);
    const headers = {
      ...(allowed ? { 'Access-Control-Allow-Origin': origin } : {}),
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Cache-Control': 'no-store',
      Vary: 'Origin',
    };
    const json = (body: object, status = 200) => Response.json(body, { status, headers });
    if (!allowed) return json({ error: 'Origem não autorizada.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
    try {
      const text = await request.text();
      if (text.length > 4096) return json({ error: 'Solicitação inválida.' }, 400);
      const parsed = accessRequest.safeParse(JSON.parse(text));
      if (!parsed.success) return json({ error: 'Solicitação inválida.' }, 400);
      const body = parsed.data;
      if (body.website?.trim()) return json({ ok: true });
      if (body.action === 'request') {
        const code = ports.randomCode();
        const result = await ports.issue(body.email, await ports.hash(body.email, code));
        if (result.status !== 'issued') return json({ ok: true });
        try {
          await ports.send(body.email, code, result.id, origin);
          await ports.delivered(result.id, true);
        } catch (error) {
          if (options.hideDeliveryFailure) {
            await ports.delivered(result.id, false).catch(() => {});
            return json({ ok: true });
          }
          await ports.delivered(result.id, false);
          throw error;
        }
        return json({ ok: true });
      }
      const subject = await ports.consume(body.email, await ports.hash(body.email, body.code));
      if (!subject) return json({ error: 'Código inválido ou expirado.' }, 400);
      // Consumo precede emissão Auth: falha/resultado incerto não reabre código já consumido.
      return json({ ok: true, session: await ports.session(subject), role: subject.role });
    } catch {
      return json({ error: 'Não foi possível concluir o acesso. Tente novamente.' }, 500);
    }
  };
}
