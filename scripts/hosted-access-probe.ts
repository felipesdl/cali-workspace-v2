import { z } from 'zod';
import { readEnvironment } from '../src/config/environment';
import { workspaceProfileRecordSchema } from '../src/api/modules/access/schemas';

// Ferramenta manual de QA. Importar somente no DevTools da aba Cliente de teste.
// Não integra o bundle da SPA, não autentica, não renova e não exporta credenciais.
export const fixtureProbeSchema = z
  .strictObject({
    actor: z.enum(['A', 'B']),
    profileId: z.uuid(),
    companyId: z.uuid(),
    otherProfileId: z.uuid(),
    otherCompanyId: z.uuid(),
  })
  .refine(
    (s) => s.profileId !== s.otherProfileId && s.companyId !== s.otherCompanyId,
    'A prova exige atores e empresas distintos.',
  );
const storedSessionSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
});
const claimsSchema = z.object({ sub: z.uuid(), iss: z.url(), exp: z.number().int().positive() });
const companyRows = z.array(z.object({ id: z.uuid() }));
const profileRows = z.array(workspaceProfileRecordSchema);
const inviteRows = z.array(z.object({ id: z.uuid(), company_id: z.uuid() }));
const userSchema = z.object({ id: z.uuid() });
const errorSchema = z.object({ code: z.string().optional(), error_code: z.string().optional() });
const markerSchema = z.array(z.object({ id: z.uuid(), notes: z.string().nullable() }));
const fileFixtures = {
  A: {
    companyId: '9c5ab148-78b8-4410-9338-58c44222a5db',
    hash: '8a3a566e25dcadc6e5ada86e3a24f7c6eb0ad6d34c09cc4ce05ea8c41a10084d',
  },
  B: {
    companyId: '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76',
    hash: '9cae9f7ea67b40ba888df9b661228a4c32c2cc832172d35a954e52df5b492ea2',
  },
};

export async function prepareFixtureProbe(input: z.infer<typeof fixtureProbeSchema>) {
  const spec = fixtureProbeSchema.parse(input);
  const environment = readEnvironment(import.meta.env);
  if (
    environment.mode !== 'supabase' ||
    window.location.hostname !== '127.0.0.1' ||
    !['5181', '5182'].includes(window.location.port)
  )
    throw new Error('Use somente as abas locais A/B dedicadas.');
  const { url, publishableKey } = environment;
  const storageKey = `cali-v2-${new URL(url).hostname.split('.')[0]}-auth`;
  function capture() {
    const session = storedSessionSchema.parse(
      JSON.parse(localStorage.getItem(storageKey) ?? 'null'),
    );
    const raw = session.access_token.split('.')[1];
    const claims = claimsSchema.parse(JSON.parse(atob(raw.replace(/-/g, '+').replace(/_/g, '/'))));
    if (claims.sub !== spec.profileId || claims.iss !== `${url}/auth/v1`)
      throw new Error('Sessão não pertence ao ator de teste esperado.');
    return { ...session, exp: claims.exp };
  }
  let credentials = capture();
  async function get<Schema extends z.ZodType>(path: string, schema: Schema) {
    const response = await fetch(`${url}${path}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${credentials.access_token}`,
        'Accept-Profile': 'cali_workspace',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(12000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = errorSchema.safeParse(payload);
      const code = error.success ? (error.data.code ?? error.data.error_code ?? null) : null;
      return { ok: false as const, http: response.status, code };
    }
    return { ok: true as const, http: response.status, data: schema.parse(payload) };
  }
  const user = await get('/auth/v1/user', userSchema);
  if (!user.ok || user.data.id !== spec.profileId)
    throw new Error('Auth não confirmou o ator de teste.');
  const profile = await get(
    `/rest/v1/profiles?select=id,company_id,role,active&id=eq.${spec.profileId}`,
    profileRows,
  );
  if (
    !profile.ok ||
    profile.data.length !== 1 ||
    profile.data[0].role !== 'client' ||
    profile.data[0].company_id !== spec.companyId ||
    !profile.data[0].active
  )
    throw new Error('Perfil Cliente ativo não confere com a fixture.');
  const own = await get(`/rest/v1/companies?select=id,notes&id=eq.${spec.companyId}`, markerSchema);
  if (
    !own.ok ||
    own.data.length !== 1 ||
    own.data[0].notes !== `CALI_V2_TEST_${spec.actor}_20261101`
  )
    throw new Error('Empresa de teste não confirmada; nenhuma prova será executada.');
  async function file(actor: 'A' | 'B', cache: 'no-store' | 'default', accessToken: string) {
    const fixture = fileFixtures[actor];
    const path = `documents/${fixture.companyId}/qa-aceite-2a-${actor.toLowerCase()}.pdf`;
    const response = await fetch(
      `${url}/storage/v1/object/authenticated/cali-workspace-private/${path}`,
      {
        cache,
        headers: { apikey: publishableKey, Authorization: `Bearer ${accessToken}` },
        redirect: 'error',
        signal: AbortSignal.timeout(12000),
      },
    );
    let fixtureMatches = false;
    if (response.ok) {
      const digest = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
      const hex = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
      fixtureMatches = hex === fixture.hash;
    }
    return {
      http: response.status,
      fixtureMatches,
      age: response.headers.get('age'),
      cacheControl: response.headers.get('cache-control'),
    };
  }
  return {
    async readFiles(cache: 'no-store' | 'default' = 'no-store') {
      const otherActor = spec.actor === 'A' ? 'B' : 'A';
      if (
        spec.companyId !== fileFixtures[spec.actor].companyId ||
        spec.otherCompanyId !== fileFixtures[otherActor].companyId
      )
        throw new Error('Empresas não correspondem aos PDFs de homologação.');
      const { access_token: accessToken } = capture();
      const [ownFile, otherFile] = await Promise.all([
        file(spec.actor, cache, accessToken),
        file(otherActor, cache, accessToken),
      ]);
      return { actor: spec.actor, cache, ownFile, otherFile };
    },
    captureBeforeLogout() {
      credentials = capture();
      return {
        actor: spec.actor,
        expiresAt: new Date(credentials.exp * 1000).toISOString(),
        secondsUntilExpiry: Math.max(0, Math.ceil(credentials.exp - Date.now() / 1000)),
      };
    },
    async read(stage: 'active' | 'revoked' | 'restored' | 'after_logout' | 'expired') {
      const auth = await get('/auth/v1/user', userSchema);
      const ownProfile = await get(
        `/rest/v1/profiles?select=id,company_id,role,active&id=eq.${spec.profileId}`,
        profileRows,
      );
      const otherProfile = await get(
        `/rest/v1/profiles?select=id,company_id,role,active&id=eq.${spec.otherProfileId}`,
        profileRows,
      );
      const ownCompany = await get(
        `/rest/v1/companies?select=id&id=eq.${spec.companyId}`,
        companyRows,
      );
      const otherCompany = await get(
        `/rest/v1/companies?select=id&id=eq.${spec.otherCompanyId}`,
        companyRows,
      );
      const companies = await get('/rest/v1/companies?select=id', companyRows);
      const otherInvites = await get(
        `/rest/v1/client_invites?select=id,company_id&company_id=eq.${spec.otherCompanyId}`,
        inviteRows,
      );
      const summary = <Rows extends { id: string }>(
        result:
          | { ok: true; http: number; data: Rows[] }
          | { ok: false; http: number; code: string | null },
      ) =>
        result.ok
          ? { http: result.http, rows: result.data.length }
          : { http: result.http, code: result.code, rows: null };
      return {
        actor: spec.actor,
        stage,
        remainingTokenSeconds: Math.ceil(credentials.exp - Date.now() / 1000),
        auth: { http: auth.http, confirmed: auth.ok && auth.data.id === spec.profileId },
        ownProfile: {
          ...summary(ownProfile),
          active: ownProfile.ok ? (ownProfile.data[0]?.active ?? null) : null,
        },
        otherProfile: summary(otherProfile),
        ownCompany: summary(ownCompany),
        otherCompany: summary(otherCompany),
        companyList: {
          ...summary(companies),
          onlyOwnCompany: companies.ok && companies.data.every((c) => c.id === spec.companyId),
        },
        otherCompanyInvites: summary(otherInvites),
      };
    },
    async verifyRefreshRevoked() {
      if (localStorage.getItem(storageKey))
        throw new Error('Faça logout pela UI antes desta prova.');
      const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        cache: 'no-store',
        headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: credentials.refresh_token }),
        redirect: 'error',
        signal: AbortSignal.timeout(12000),
      });
      const payload = await response.json().catch(() => null);
      const error = errorSchema.safeParse(payload);
      let cleanupHttp: number | null = null;
      if (response.ok) {
        const unexpected = storedSessionSchema.parse(payload);
        const cleanup = await fetch(`${url}/auth/v1/logout?scope=local`, {
          method: 'POST',
          headers: { apikey: publishableKey, Authorization: `Bearer ${unexpected.access_token}` },
          redirect: 'error',
        });
        cleanupHttp = cleanup.status;
      }
      return {
        actor: spec.actor,
        http: response.status,
        rejected: !response.ok,
        code: error.success ? (error.data.error_code ?? error.data.code ?? null) : null,
        cleanupHttp,
      };
    },
    forget() {
      credentials = { access_token: '', refresh_token: '', exp: 0 };
    },
  };
}
