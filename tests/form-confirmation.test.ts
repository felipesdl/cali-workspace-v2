// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { createFormConfirmationHandler } from '../supabase/functions/cali-forms-confirmation/handler';

it('reusa a identidade do e-mail se o registro falhar após o provedor aceitar', async () => {
  const responseId = '10000000-0000-4000-8000-000000000001';
  const receipts = new Set<string>();
  let recordAttempts = 0;
  const transport = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname.endsWith('/runtime_secrets'))
      return Response.json({ secret_value: 'fixture' });
    if (url.hostname === 'api.resend.com') {
      const key = new Headers(init?.headers).get('Idempotency-Key');
      expect(key).toBe(`cali-form-confirmation/${responseId}`);
      if (key) receipts.add(key);
      expect(JSON.parse(String(init?.body)).to).toEqual(['pessoa@example.test']);
      return Response.json({ id: 'receipt-fixture' });
    }
    if (url.pathname.endsWith('/form_responses')) {
      if (init?.method === 'HEAD')
        return new Response(null, { headers: { 'Content-Range': '*/0' } });
      if (init?.method === 'PATCH') {
        recordAttempts++;
        return new Response(null, { status: recordAttempts === 1 ? 503 : 204 });
      }
      return Response.json([
        {
          id: responseId,
          answers: { name: 'Pessoa de teste' },
          respondent_name: 'Pessoa de teste',
          respondent_email: 'pessoa@example.test',
          confirmation_sent_at: recordAttempts >= 2 ? '2026-11-11T12:00:00Z' : null,
          forms: {
            title: 'Formulário de teste',
            thank_you: null,
            questions: [{ id: 'name', kind: 'text', label: 'Nome' }],
            confirm_email: true,
          },
        },
      ]);
    }
    return new Response(null, { status: 500 });
  });
  const config = {
    project: 'https://supabase.example.test',
    service: 'service-fixture',
    resend: 'resend-fixture',
    app: 'https://cali-qa.vercel.app',
  };
  const handle = createFormConfirmationHandler(
    { ...config, testRecipients: ['pessoa@example.test'] },
    transport,
  );
  const send = (handler = handle) =>
    handler(
      new Request('https://supabase.example.test/functions/v1/cali-forms-confirmation', {
        method: 'POST',
        headers: { 'x-workspace-hook': 'fixture' },
        body: JSON.stringify({ response_id: responseId }),
      }),
    );

  const restricted = createFormConfirmationHandler(config, transport);
  expect(await (await send(restricted)).json()).toEqual({ ok: true, skipped: true });
  expect(receipts.size).toBe(0);
  expect((await send()).status).toBe(500);
  expect(await (await send()).json()).toEqual({ ok: true });
  expect(await (await send()).json()).toEqual({ ok: true, skipped: true });
  expect(receipts.size).toBe(1);
  expect(
    transport.mock.calls.filter(([url]) => String(url).includes('api.resend.com')),
  ).toHaveLength(2);
});
