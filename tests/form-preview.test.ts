// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { GET } from '../api/form-preview';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('usa o resolvedor público e preserva o link ao gerar a prévia social', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://fixture.supabase.co');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_fixture');
  const transport = vi.fn<typeof fetch>(async () =>
    Response.json({
      source: 'legacy',
      status: 'open',
      title: 'Pesquisa <CALI>',
      description: '**Avaliação** "2026"',
      answers: 'fixture privada',
    }),
  );
  vi.stubGlobal('fetch', transport);

  const result = await GET(
    new Request('https://cali-qa.vercel.app/api/form-preview?slug=pesquisa'),
  );
  const html = await result.text();

  expect(transport).toHaveBeenCalledWith(
    new URL('https://fixture.supabase.co/rest/v1/rpc/v2_resolve_public_form'),
    expect.objectContaining({ method: 'POST', body: '{"p_slug":"pesquisa"}' }),
  );
  expect(html).toContain('<title>Pesquisa &lt;CALI&gt;</title>');
  expect(html).toContain('content="Avaliação &quot;2026&quot;"');
  expect(html).toContain('rel="canonical" href="https://cali-qa.vercel.app/f/pesquisa"');
  expect(html).not.toContain('fixture privada');
});
