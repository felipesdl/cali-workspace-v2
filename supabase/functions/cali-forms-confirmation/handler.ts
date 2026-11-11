import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const question = z.object({ id: z.string(), kind: z.string(), label: z.string() });
const form = z.object({
  title: z.string(),
  thank_you: z.string().nullable(),
  questions: z.array(question),
  confirm_email: z.boolean(),
});
const answer = z.union([z.string(), z.number(), z.array(z.string()), z.null()]);
const entry = z.object({
  id: z.uuid(),
  answers: z.record(z.string(), answer).nullable(),
  respondent_name: z.string().nullable(),
  respondent_email: z.email().nullable(),
  confirmation_sent_at: z.string().nullable(),
  forms: form.nullable(),
});
const esc = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
function answerText(kind: string, value: z.infer<typeof answer> | undefined) {
  if (value == null || value === '') return '—';
  if (kind === 'file') return 'Arquivo enviado';
  if (Array.isArray(value)) return value.join(', ');
  if (kind === 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return value.split('-').reverse().join('/');
  return String(value);
}
function html(app: string, title: string, name: string, thankYou: string, rows: string) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F7F3EE;font-family:Arial,Helvetica,sans-serif;color:#2B2B2B">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 14px">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fff;border:1px solid #E8DDD4;border-radius:18px;overflow:hidden">
      <tr><td style="padding:20px 26px;border-bottom:1px solid #6A2838;background:#5A1E2D">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td align="left" valign="middle"><img src="${app}/brand/cali-workspace-transparent.svg" alt="CALI RH" width="122" style="display:block;width:122px;max-width:122px;height:auto"></td>
          <td align="right" valign="middle"><img src="${app}/brand/cali-oak-mark-light.svg" alt="" width="48" height="48" style="display:block;width:48px;height:48px;object-fit:contain"></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:30px">
        <div style="font-size:10px;letter-spacing:.12em;color:#B58C52;font-weight:700;margin-bottom:8px">CALI FORMS</div>
        <h1 style="font-family:Georgia,serif;font-size:25px;line-height:1.25;font-weight:400;color:#5A1E2D;margin:0 0 14px">Recebemos sua resposta</h1>
        <p style="font-size:15px;line-height:1.65;margin:0 0 10px">${name ? `Olá, ${esc(name)}. ` : ''}Obrigada por responder <strong>${esc(title)}</strong>.</p>
        ${thankYou ? `<p style="font-size:15px;line-height:1.65;margin:0 0 10px">${esc(thankYou)}</p>` : ''}
        <p style="font-size:13px;line-height:1.6;color:#6B5D63;margin:18px 0 10px">Para sua referência, uma cópia do que você enviou:</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8DDD4;border-radius:12px;border-collapse:separate;overflow:hidden">${rows}</table>
      </td></tr>
      <tr><td style="padding:18px 30px;border-top:1px solid #EFE6DF;font-size:11px;line-height:1.6;color:#8C807A">
        Este é um e-mail automático da CALI RH e não recebe respostas. Dúvidas sobre privacidade: privacidade@calirh.com.
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

export function createFormConfirmationHandler(
  config: { project: string; service: string; resend: string; app: string },
  transport: typeof fetch = fetch,
) {
  const ws = createClient(config.project, config.service, {
    db: { schema: 'cali_workspace' },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: transport },
  });
  return async (request: Request) => {
    const reply = (body: object, status = 200) =>
      Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
    if (request.method !== 'POST') return reply({ ok: false }, 405);
    const provided = request.headers.get('x-workspace-hook');
    if (!provided) return reply({ ok: false }, 401);
    try {
      const secret = await ws
        .from('runtime_secrets')
        .select('secret_value')
        .eq('secret_key', 'notification_email_hook')
        .single();
      const expected = z.object({ secret_value: z.string().min(1) }).safeParse(secret.data);
      if (secret.error || !expected.success || provided !== expected.data.secret_value)
        return reply({ ok: false }, 401);
      const input = z.object({ response_id: z.uuid() }).safeParse(await request.json());
      if (!input.success) return reply({ ok: false }, 400);
      const result = await ws
        .from('form_responses')
        .select(
          'id,answers,respondent_name,respondent_email,confirmation_sent_at,forms(title,thank_you,questions,confirm_email)',
        )
        .eq('id', input.data.response_id)
        .maybeSingle();
      if (result.error || !result.data) return reply({ ok: false }, 404);
      const row = entry.parse(result.data);
      const details = row.forms;
      if (row.confirmation_sent_at || !row.respondent_email || !details?.confirm_email)
        return reply({ ok: true, skipped: true });
      const quota = await ws
        .from('form_responses')
        .select('id', { count: 'exact', head: true })
        .eq('respondent_email', row.respondent_email)
        .gte('confirmation_sent_at', new Date(Date.now() - 86400000).toISOString());
      if (quota.error) throw new Error('Contagem de envios indisponível.');
      if ((quota.count ?? 0) >= 5) return reply({ ok: true, skipped: true });
      const rows = details.questions
        .filter((item) => item.kind !== 'statement' && row.answers?.[item.id] !== undefined)
        .map(
          (item) =>
            `<tr><td style="padding:11px 14px;border-top:1px solid #EFE6DF;font-size:12px;color:#6B5D63">${esc(item.label.replace(/\*\*|__|\*/g, ''))}</td><td style="padding:11px 14px;border-top:1px solid #EFE6DF;font-size:14px;white-space:pre-wrap">${esc(answerText(item.kind, row.answers?.[item.id]))}</td></tr>`,
        )
        .join('');
      const sent = await transport('https://api.resend.com/emails', {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
        headers: {
          Authorization: `Bearer ${config.resend}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `cali-form-confirmation/${row.id}`,
        },
        body: JSON.stringify({
          from: 'CALI RH <workspace@calirh.com>',
          to: [row.respondent_email],
          reply_to: 'nao-responda@calirh.com',
          subject: `Recebemos sua resposta · ${details.title.replace(/[\r\n]+/g, ' ')}`,
          html: html(
            config.app,
            details.title,
            row.respondent_name ?? '',
            details.thank_you ?? '',
            rows,
          ),
        }),
      });
      if (!sent.ok) return reply({ ok: false }, 502);
      const recorded = await ws
        .from('form_responses')
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq('id', row.id)
        .is('confirmation_sent_at', null);
      if (recorded.error) throw new Error('Confirmação ainda não registrada.');
      return reply({ ok: true });
    } catch {
      return reply({ ok: false }, 500);
    }
  };
}
