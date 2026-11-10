const fixtures = {
  a: {
    path: '9c5ab148-78b8-4410-9338-58c44222a5db/account/arquivo-qa-aceite-2a-a.pdf',
    sha256: '8a3a566e25dcadc6e5ada86e3a24f7c6eb0ad6d34c09cc4ce05ea8c41a10084d',
  },
  b: {
    path: '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76/account/arquivo-qa-aceite-2a-b.pdf',
    sha256: '9cae9f7ea67b40ba888df9b661228a4c32c2cc832172d35a954e52df5b492ea2',
  },
} as const;
type Fixture = keyof typeof fixtures;
const origins = new Set(['http://127.0.0.1:5181', 'http://127.0.0.1:5182']);

type PilotPdfDependencies = {
  authorize: (authorization: string, fixture: Fixture) => Promise<boolean>;
  read: (path: string) => Promise<ArrayBuffer>;
};

export function createPilotPdfHandler({ authorize, read }: PilotPdfDependencies) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('Origin');
    const headers = new Headers({
      'Cache-Control': 'private, no-store',
      Vary: 'Origin',
      'X-Content-Type-Options': 'nosniff',
    });
    const respond = (status: number) => new Response(null, { status, headers });
    if (!origin || !origins.has(origin)) return respond(403);

    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Headers', 'authorization, apikey, content-type');
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (request.method === 'OPTIONS') return respond(204);
    if (request.method !== 'POST') return respond(405);

    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return respond(401);
    const fixture = new URL(request.url).searchParams.get('fixture');
    if (fixture !== 'a' && fixture !== 'b') return respond(400);

    try {
      if (!(await authorize(authorization, fixture))) return respond(403);
      const { path, sha256 } = fixtures[fixture];
      const bytes = await read(path);
      const digest = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
        (byte) => byte.toString(16).padStart(2, '0'),
      ).join('');
      if (digest !== sha256) return respond(503);
      if (!(await authorize(authorization, fixture))) return respond(403);
      headers.set('Content-Type', 'application/pdf');
      headers.set('Content-Disposition', `attachment; filename="qa-aceite-2a-${fixture}.pdf"`);
      return new Response(bytes, { headers });
    } catch {
      return respond(503);
    }
  };
}
