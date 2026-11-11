import { z } from 'zod';

const preview = z.object({
  source: z.enum(['legacy', 'pilot']),
  status: z.literal('open'),
  title: z.string().min(1).max(300),
  description: z.string().max(1200).nullish(),
});
const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get('slug') ?? '';
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) return new Response('Não encontrado', { status: 404 });
  const origin = new URL(request.url).origin;
  const configured = z.url().safeParse(process.env.VITE_SUPABASE_URL);
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  let title = 'CALI Forms';
  let description = 'Formulário da CALI RH.';
  if (configured.success && key?.startsWith('sb_publishable_')) {
    const backend = new URL(configured.data);
    if (
      backend.protocol === 'https:' &&
      /^[a-z0-9-]+\.supabase\.co$/.test(backend.hostname) &&
      !backend.username &&
      !backend.password &&
      !backend.port &&
      backend.pathname === '/' &&
      !backend.search &&
      !backend.hash
    ) {
      try {
        const response = await fetch(new URL('/rest/v1/rpc/v2_resolve_public_form', backend), {
          method: 'POST',
          headers: { apikey: key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_slug: slug }),
          signal: AbortSignal.timeout(4000),
        });
        const result = response.ok ? preview.nullable().safeParse(await response.json()) : null;
        if (result?.success && result.data?.title) {
          title = result.data.title;
          const text = (result.data.description ?? '')
            .replace(/\*\*|__|~~|[*_]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          description = text ? text.slice(0, 160) : 'Formulário · CALI RH';
        }
      } catch {
        // A prévia genérica continua disponível quando a consulta pública falha.
      }
    }
  }
  const url = escape(new URL(`/f/${slug}`, origin).href);
  const image = escape(new URL('/brand/cali-forms-thumb.png', origin).href);
  return new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${escape(title)}</title><meta name="description" content="${escape(description)}">
<meta property="og:type" content="website"><meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}">
<meta property="og:url" content="${url}"><meta property="og:image" content="${image}">
<meta property="og:image:width" content="200"><meta property="og:image:height" content="200">
<meta name="twitter:card" content="summary"><meta name="twitter:image" content="${image}">
<link rel="canonical" href="${url}"></head><body><a href="${url}">${escape(title)}</a></body></html>`,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      },
    },
  );
}
