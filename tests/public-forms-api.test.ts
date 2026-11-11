// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
const upload = vi.hoisted(() => vi.fn());

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc, storage: { from: () => ({ upload }) } }),
}));

import { createPublicForms } from '../src/api/shared/forms/public';

const form = {
  source: 'legacy' as const,
  formId: '7b6aeb7c-467d-4a3e-9ac6-a05a59f8a92d',
  slug: 'coleta-cali',
  status: 'open' as const,
  title: 'Coleta',
  description: null,
  questions: [{ id: 'q1', kind: 'short_text' as const, label: 'Resposta', required: false }],
  confirmationEnabled: false,
};

beforeEach(() => {
  rpc.mockReset();
  upload.mockReset();
});

test('envia identidade resolvida, origem, slug e tentativa no contrato final', async () => {
  rpc.mockResolvedValue({ data: { ok: true, confirmation: false }, error: null });
  const service = createPublicForms('https://example.test', 'public-key');

  await service.submit(form, '5aa8b6e0-3412-4c08-85e7-e944576d6ee2', { q1: 'Resposta' }, ['q1']);

  expect(rpc).toHaveBeenCalledWith('v2_submit_resolved_public_form', {
    p_slug: 'coleta-cali',
    p_form_id: '7b6aeb7c-467d-4a3e-9ac6-a05a59f8a92d',
    p_origin: 'legacy',
    p_request_id: '5aa8b6e0-3412-4c08-85e7-e944576d6ee2',
    p_answers: { q1: 'Resposta', __visited: ['q1'] },
  });
});

test('falha fechada se origem ou registro mudar após leitura', async () => {
  rpc.mockResolvedValue({ data: null, error: { code: 'P0002' } });
  const service = createPublicForms('https://example.test', 'public-key');

  await expect(
    service.submit(form, '5aa8b6e0-3412-4c08-85e7-e944576d6ee2', { q1: 'Resposta' }, ['q1']),
  ).rejects.toThrow('A origem do formulário mudou. Recarregue antes de continuar.');
});

test('resolve somente pelo dispatcher estrito e retorna indisponível sem fallback', async () => {
  rpc.mockReturnValue({
    abortSignal: async () => ({ data: { source: 'unavailable' }, error: null }),
  });
  const service = createPublicForms('https://example.test', 'public-key');

  await expect(service.read('coleta-cali', new AbortController().signal)).resolves.toBeNull();
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('v2_resolve_public_form', { p_slug: 'coleta-cali' });
});
