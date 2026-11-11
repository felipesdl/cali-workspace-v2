import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const command = z.discriminatedUnion('action', [
  z.object({ action: z.enum(['status', 'authorize', 'disconnect']) }),
  z.object({
    action: z.literal('exchange'),
    code: z.string().min(1).max(4000),
    state: z.string().min(1).max(4000),
  }),
  z.object({ action: z.literal('copy_file'), fileId: z.uuid() }),
  z.object({ action: z.literal('copy_folder'), deliverableId: z.uuid() }),
]);
const connectionSchema = z.object({
  id: z.uuid(),
  credential_key: z.string(),
  account_email: z.email(),
  google_account_id: z.string().nullable(),
  root_folder_id: z.string().nullable(),
  root_folder_name: z.string().nullable(),
  status: z.string(),
});
const credentialSchema = z.object({
  access_token: z.string().nullable(),
  refresh_token: z.string(),
  expires_at: z.string().nullable(),
});
const tokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number().optional(),
  scope: z.string().optional(),
});
const fileSchema = z.object({
  id: z.string(),
  trashed: z.boolean().optional(),
  webViewLink: z.string().optional(),
});
const leaseSchema = z.discriminatedUnion('done', [
  z.object({ done: z.literal(true), url: z.url() }),
  z.object({
    done: z.literal(false),
    lease: z.uuid(),
    providerId: z.string().nullable(),
    path: z.string(),
    name: z.string(),
    fileType: z.string().nullable(),
    deliverable: z.uuid().nullable(),
  }),
]);
type Config = {
  project: string;
  anon: string;
  service: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  origins: string[];
};
const encoder = new TextEncoder();
function base64(bytes: Uint8Array) {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
async function hmac(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}
function decode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(normalized + '='.repeat((4 - (normalized.length % 4)) % 4)), (char) =>
    char.charCodeAt(0),
  );
}

export function createDriveHandler(config: Config, transport: typeof fetch = fetch) {
  return async (request: Request) => {
    const origin = request.headers.get('origin') ?? '';
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      Vary: 'Origin',
      'Access-Control-Allow-Origin': config.origins.includes(origin) ? origin : config.origins[0],
      'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
    };
    const reply = (body: object, status = 200) =>
      new Response(JSON.stringify(body), { status, headers });
    if (origin && !config.origins.includes(origin))
      return reply({ error: 'origin_not_allowed' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return reply({ error: 'invalid_session' }, 401);
    const auth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
    const user = createClient(config.project, config.anon, {
      auth,
      db: { schema: 'cali_workspace' },
      global: { headers: { Authorization: authorization }, fetch: transport },
    });
    const root = createClient(config.project, config.service, {
      auth,
      db: { schema: 'cali_workspace' },
      global: { fetch: transport },
    });
    try {
      const input = command.parse(await request.json());
      const { data: session, error: authError } = await user.auth.getUser();
      if (authError || !session.user) return reply({ error: 'invalid_session' }, 401);
      const actor = session.user.id;
      const accepted = await user.rpc('v2_read_terms_state');
      if (
        accepted.error ||
        !z.object({ accepted: z.literal(true) }).safeParse(accepted.data).success
      )
        return reply({ error: 'session_not_admitted' }, 403);
      const profileResult = await user
        .from('profiles')
        .select('company_id,active,role')
        .eq('id', actor)
        .single();
      if (profileResult.error) return reply({ error: 'profile_not_available' }, 403);
      const profile = z
        .object({ company_id: z.uuid(), active: z.literal(true), role: z.literal('client') })
        .parse(profileResult.data);
      const company = profile.company_id;
      async function google<T>(url: string, schema: z.ZodType<T>, init: RequestInit = {}) {
        const response = await transport(url, {
          ...init,
          signal: AbortSignal.timeout(25000),
          redirect: 'error',
        });
        if (!response.ok) throw new Error('Operação Google indisponível.');
        return schema.parse(await response.json());
      }
      async function connection(includeRevoked = false) {
        let query = root
          .from('drive_connections')
          .select(
            'id,credential_key,account_email,google_account_id,root_folder_id,root_folder_name,status',
          )
          .eq('company_id', company)
          .eq('owner_type', 'client');
        if (!includeRevoked) query = query.eq('status', 'connected');
        const result = await query.order('updated_at', { ascending: false }).limit(1).maybeSingle();
        if (result.error) throw new Error('Conexão indisponível.');
        return connectionSchema.nullable().parse(result.data);
      }
      async function updateConnection(id: string, values: object) {
        const result = await root
          .from('drive_connections')
          .update({ ...values, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('company_id', company);
        if (result.error) throw new Error('Não foi possível atualizar a conexão.');
      }
      async function credential(key: string) {
        const result = await root
          .from('google_calendar_credentials')
          .select('access_token,refresh_token,expires_at')
          .eq('credential_key', key)
          .single();
        if (result.error) throw new Error('Credencial indisponível.');
        return credentialSchema.parse(result.data);
      }
      async function accessToken(key: string) {
        const value = await credential(key);
        if (value.access_token && Date.parse(value.expires_at ?? '') > Date.now() + 60000)
          return value.access_token;
        const token = await google('https://oauth2.googleapis.com/token', tokenSchema, {
          method: 'POST',
          body: new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            refresh_token: value.refresh_token,
            grant_type: 'refresh_token',
          }),
        });
        const result = await root
          .from('google_calendar_credentials')
          .update({
            access_token: token.access_token,
            expires_at: new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString(),
          })
          .eq('credential_key', key);
        if (result.error) throw new Error('Não foi possível renovar a conexão.');
        return token.access_token;
      }
      if (input.action === 'authorize') {
        const payload = base64(
          encoder.encode(
            JSON.stringify({
              purpose: 'drive',
              user_id: actor,
              company_id: company,
              exp: Math.floor(Date.now() / 1000) + 600,
              nonce: crypto.randomUUID(),
            }),
          ),
        );
        const signature = base64(
          new Uint8Array(
            await crypto.subtle.sign(
              'HMAC',
              await hmac(config.clientSecret),
              encoder.encode(payload),
            ),
          ),
        );
        const params = new URLSearchParams({
          client_id: config.clientId,
          redirect_uri: config.redirectUri,
          response_type: 'code',
          scope: 'openid email https://www.googleapis.com/auth/drive.file',
          access_type: 'offline',
          include_granted_scopes: 'true',
          prompt: 'consent',
          state: `${payload}.${signature}`,
        });
        return reply({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
      }
      if (input.action === 'exchange') {
        const parts = input.state.split('.');
        if (
          parts.length !== 2 ||
          !(await crypto.subtle.verify(
            'HMAC',
            await hmac(config.clientSecret),
            decode(parts[1]),
            encoder.encode(parts[0]),
          ))
        )
          return reply({ error: 'invalid_state' }, 400);
        const state = z
          .object({
            purpose: z.literal('drive'),
            user_id: z.literal(actor),
            company_id: z.literal(company),
            exp: z.number().int(),
          })
          .parse(JSON.parse(new TextDecoder().decode(decode(parts[0]))));
        if (state.exp < Math.floor(Date.now() / 1000))
          return reply({ error: 'expired_state' }, 400);
        const tokens = await google('https://oauth2.googleapis.com/token', tokenSchema, {
          method: 'POST',
          body: new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code: input.code,
            redirect_uri: config.redirectUri,
            grant_type: 'authorization_code',
          }),
        });
        const identity = await google(
          'https://openidconnect.googleapis.com/v1/userinfo',
          z.object({ email: z.email(), sub: z.string() }),
          { headers: { Authorization: `Bearer ${tokens.access_token}` } },
        );
        const key = `${actor}:${company}`;
        const previous = await root
          .from('google_calendar_credentials')
          .select('refresh_token')
          .eq('credential_key', key)
          .maybeSingle();
        if (previous.error) throw new Error('Credencial indisponível.');
        const old = z
          .object({ refresh_token: z.string().nullable() })
          .nullable()
          .parse(previous.data);
        const refresh = tokens.refresh_token ?? old?.refresh_token;
        if (!refresh) return reply({ error: 'google_refresh_token_missing' }, 409);
        const credentials = await root.from('google_calendar_credentials').upsert(
          {
            credential_key: key,
            user_id: actor,
            company_id: company,
            account_email: identity.email,
            provider_account_id: identity.sub,
            access_token: tokens.access_token,
            refresh_token: refresh,
            token_type: 'Bearer',
            scope: tokens.scope ?? '',
            expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'credential_key' },
        );
        if (credentials.error) throw new Error('Não foi possível guardar a conexão.');
        const existing = await connection(true);
        const values = {
          company_id: company,
          owner_type: 'client',
          account_email: identity.email,
          google_account_id: identity.sub,
          credential_key: key,
          status: 'connected',
          connected_by: actor,
          updated_at: new Date().toISOString(),
        };
        if (existing)
          await updateConnection(existing.id, {
            ...values,
            ...(existing.google_account_id !== identity.sub
              ? { root_folder_id: null, root_folder_name: null }
              : {}),
          });
        else {
          const result = await root.from('drive_connections').insert(values);
          if (result.error) throw new Error('Não foi possível guardar a conexão.');
        }
        return reply({ ok: true, purpose: 'drive', accountEmail: identity.email });
      }
      const conn = await connection(input.action === 'disconnect');
      if (input.action === 'status')
        return reply({
          connected: Boolean(conn),
          connection: conn
            ? {
                id: conn.id,
                accountEmail: conn.account_email,
                rootFolderName: conn.root_folder_name,
                status: conn.status,
              }
            : null,
          jobs: [],
        });
      if (input.action === 'disconnect') {
        if (!conn) return reply({ ok: true });
        await updateConnection(conn.id, { status: 'revoked' });
        const calendar = await root
          .from('calendar_connections')
          .select('id')
          .eq('credential_key', conn.credential_key)
          .eq('status', 'connected')
          .limit(1);
        if (calendar.error) throw new Error('Não foi possível conferir a agenda conectada.');
        if (!calendar.data?.length) {
          const value = await credential(conn.credential_key);
          const revoked = await transport('https://oauth2.googleapis.com/revoke', {
            method: 'POST',
            body: new URLSearchParams({ token: value.refresh_token }),
            signal: AbortSignal.timeout(8000),
          });
          if (!revoked.ok) throw new Error('A revogação no Google ainda não foi confirmada.');
          const removed = await root
            .from('google_calendar_credentials')
            .delete()
            .eq('credential_key', conn.credential_key);
          if (removed.error) throw new Error('A remoção da credencial ainda não foi confirmada.');
        }
        return reply({ ok: true });
      }
      if (!conn) return reply({ error: 'drive_not_connected' }, 409);
      const token = await accessToken(conn.credential_key);
      const googleHeaders = { Authorization: `Bearer ${token}` };
      async function folder(name: string, parent?: string) {
        const safe = name.replace(/[\\']/g, ' ').trim().slice(0, 180) || 'CALI Workspace';
        const q = `name='${safe}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parent ? ` and '${parent}' in parents` : " and 'root' in parents"}`;
        const found = await google(
          `https://www.googleapis.com/drive/v3/files?${new URLSearchParams({ q, fields: 'files(id)', pageSize: '1' })}`,
          z.object({ files: z.array(fileSchema) }),
          { headers: googleHeaders },
        );
        if (found.files[0]) return found.files[0].id;
        return (
          await google('https://www.googleapis.com/drive/v3/files?fields=id', fileSchema, {
            method: 'POST',
            headers: { ...googleHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: safe,
              mimeType: 'application/vnd.google-apps.folder',
              ...(parent ? { parents: [parent] } : {}),
            }),
          })
        ).id;
      }
      let rootId = conn.root_folder_id;
      if (rootId) {
        const check = await transport(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(rootId)}?fields=id,trashed`,
          { headers: googleHeaders, signal: AbortSignal.timeout(8000) },
        );
        if (!check.ok || fileSchema.parse(await check.json()).trashed) rootId = null;
      }
      if (!rootId) {
        rootId = await folder('CALI Workspace');
        await updateConnection(conn.id, {
          root_folder_id: rootId,
          root_folder_name: 'CALI Workspace',
        });
      }
      async function deliveryFolder(id: string) {
        const result = await user
          .from('deliverables')
          .select('title,protocol')
          .eq('company_id', company)
          .eq('id', id)
          .single();
        if (result.error) throw new Error('Pasta indisponível.');
        const delivery = z
          .object({ title: z.string(), protocol: z.string().nullable() })
          .parse(result.data);
        return folder(
          `${delivery.title}${delivery.protocol ? ` (${delivery.protocol})` : ''}`,
          rootId ?? undefined,
        );
      }
      async function job(action: string, file: string, lease?: string, provider?: string) {
        const result = await user.rpc('v2_drive_copy', {
          p_action: action,
          p_file: file,
          p_connection: conn!.id,
          p_lease: lease ?? null,
          p_provider: provider ?? null,
        });
        if (result.error)
          throw new Error('Cópia indisponível, em andamento ou com versão alterada.');
        return result.data;
      }
      async function copy(file: string) {
        const claim = leaseSchema.parse(await job('claim', file));
        if (claim.done) return { status: 'synced', url: claim.url };
        try {
          const provider =
            claim.providerId ??
            (
              await google(
                'https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive',
                z.object({ ids: z.array(z.string()).length(1) }),
                { headers: googleHeaders },
              )
            ).ids[0];
          await job('reserve', file, claim.lease, provider);
          // O ID reservado também recupera upload concluído cuja resposta se perdeu.
          const existing = await transport(
            `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(provider)}?fields=id,trashed`,
            { headers: googleHeaders, signal: AbortSignal.timeout(8000) },
          );
          if (existing.status !== 404 && !existing.ok)
            throw new Error('Não foi possível conferir a cópia anterior.');
          if (existing.ok) {
            if (fileSchema.parse(await existing.json()).trashed)
              throw new Error('A cópia foi removida do Drive.');
          } else {
            const destination = claim.deliverable
              ? await deliveryFolder(claim.deliverable)
              : rootId;
            const source = await root.storage.from('cali-workspace-private').download(claim.path);
            if (source.error || !source.data) throw new Error('Arquivo indisponível.');
            await job('reserve', file, claim.lease, provider);
            const boundary = `cali_${crypto.randomUUID()}`;
            const mime = source.data.type || 'application/octet-stream';
            const metadata = JSON.stringify({
              id: provider,
              name: claim.name,
              parents: [destination],
            });
            const body = new Blob([
              `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`,
              source.data,
              `\r\n--${boundary}--`,
            ]);
            await google(
              'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
              fileSchema,
              {
                method: 'POST',
                headers: {
                  ...googleHeaders,
                  'Content-Type': `multipart/related; boundary=${boundary}`,
                },
                body,
              },
            );
          }
          const finished = z
            .object({ done: z.literal(true), url: z.url() })
            .parse(await job('complete', file, claim.lease));
          return { status: 'synced', url: finished.url };
        } catch (error) {
          await job('fail', file, claim.lease).catch(() => null);
          throw error;
        }
      }
      if (input.action === 'copy_file') return reply(await copy(input.fileId));
      if (input.action !== 'copy_folder') return reply({ error: 'unknown_action' }, 400);
      const result = await user
        .from('files')
        .select('id')
        .eq('company_id', company)
        .eq('deliverable_id', input.deliverableId)
        .eq('status', 'published')
        .eq('client_visible', true)
        .not('storage_path', 'is', null)
        .limit(501);
      if (result.error) throw new Error('Pasta indisponível.');
      const files = z
        .array(z.object({ id: z.uuid() }))
        .min(1)
        .max(500)
        .parse(result.data);
      const folderId = await deliveryFolder(input.deliverableId);
      let copied = 0,
        failed = 0;
      const deadline = Date.now() + 45000;
      for (const file of files) {
        if (Date.now() > deadline) break;
        try {
          await copy(file.id);
          copied++;
        } catch {
          /* O item permanece disponível para nova tentativa. */
        }
      }
      failed = files.length - copied;
      return reply({
        status: failed ? 'partial' : 'synced',
        url: `https://drive.google.com/drive/folders/${folderId}`,
        copied,
        failed,
      });
    } catch {
      return reply({ error: 'drive_operation_unavailable' }, 400);
    }
  };
}
