// @vitest-environment node
import { expect, test, vi } from 'vitest';
import { dispatchAdminDigest } from '../supabase/functions/workspace-admin-digest-pilot/dispatch';

test('retenta o mesmo resumo com chave estável e só grava o recibo após aceite', async () => {
  const job = {
    claimId: '00000000-0000-4000-8000-000000000001',
    idempotencyKey: 'cali-admin-digest-test-2026-11-08-00000000-0000-4000-8000-000000000002',
    summary: {
      day: '2026-11-08',
      clientTotal: 2,
      caliTotal: 0,
      minutes: 15,
      companies: [
        {
          name: 'Empresa sintética',
          minutes: 15,
          client: {
            total: 2,
            items: [
              { at: '2026-11-08T21:40:00Z', title: 'Ação', excerpt: null, link: '/admin/projetos' },
            ],
          },
          cali: { total: 0, items: [] },
        },
      ],
    },
  };
  const receipt = '00000000-0000-4000-8000-000000000003';
  const record = vi.fn().mockResolvedValue(true);
  const send = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ id: receipt }));

  expect(await dispatchAdminDigest(null, 'chave-ficticia', send, record)).toBe(false);
  await expect(dispatchAdminDigest(job, 'chave-ficticia', send, record)).rejects.toThrow();
  expect(record).not.toHaveBeenCalled();
  const nextClaim = '00000000-0000-4000-8000-000000000004';
  expect(
    await dispatchAdminDigest({ ...job, claimId: nextClaim }, 'chave-ficticia', send, record),
  ).toBe(true);
  const first = send.mock.calls[0][1];
  const second = send.mock.calls[1][1];
  expect(second?.body).toBe(first?.body);
  expect(new Headers(second?.headers).get('Idempotency-Key')).toBe(job.idempotencyKey);
  expect(second?.body).toContain('"to":["delivered@resend.dev"]');
  expect(second?.body).toContain('18:40 · Ação');
  expect(second?.body).toContain('e mais 1');
  expect(record).toHaveBeenCalledExactlyOnceWith(nextClaim, receipt);
});
