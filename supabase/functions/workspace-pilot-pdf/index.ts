import { createPilotPdfHandler } from './handler.ts';

declare const Deno: {
  env: { get: (name: string) => string | undefined };
  serve: (handler: (request: Request) => Promise<Response>) => void;
};

const project = Deno.env.get('SUPABASE_URL');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
const storageKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (project !== 'https://kqtbfeeqbcllwvlkbrkq.supabase.co' || !anonKey || !storageKey) {
  throw new Error('Configuração de homologação inválida.');
}

Deno.serve(
  createPilotPdfHandler({
    async authorize(authorization, fixture) {
      const response = await fetch(`${project}/rest/v1/rpc/v2_can_download_pilot_pdf`, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(4000),
        headers: {
          apikey: anonKey,
          Authorization: authorization,
          'Content-Profile': 'cali_workspace',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_fixture: fixture }),
      });
      if (response.status === 401 || response.status === 403) return false;
      if (!response.ok) throw new Error('Autorização indisponível.');
      return (await response.json()) === true;
    },
    async read(path) {
      const url = new URL(
        `${project}/storage/v1/object/authenticated/cali-workspace-private/${path}`,
      );
      url.searchParams.set('cacheNonce', crypto.randomUUID());
      const response = await fetch(url, {
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
        headers: { apikey: storageKey, Authorization: `Bearer ${storageKey}` },
      });
      if (!response.ok) throw new Error('Fixture indisponível.');
      return response.arrayBuffer();
    },
  }),
);
