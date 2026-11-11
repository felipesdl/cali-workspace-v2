// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { createDriveHandler } from '../supabase/functions/google-drive-oauth/handler';

const actor = '10000000-0000-4000-8000-000000000001';
const company = '10000000-0000-4000-8000-000000000002';
const origin = 'http://127.0.0.1:5173';

function setup({
  previousSubject = 'old-account',
  refresh = false,
  copyTransport,
}: { previousSubject?: string; refresh?: boolean; copyTransport?: typeof fetch } = {}) {
  const transport = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname === '/auth/v1/user') return Response.json({ id: actor });
    if (url.pathname.endsWith('/rpc/v2_read_terms_state')) return Response.json({ accepted: true });
    if (url.pathname.endsWith('/profiles'))
      return Response.json({ company_id: company, active: true, role: 'client' });
    if (url.hostname === 'oauth2.googleapis.com')
      return Response.json({
        access_token: 'new-access',
        ...(refresh && { refresh_token: 'new-refresh' }),
      });
    if (url.hostname === 'openidconnect.googleapis.com')
      return Response.json({ email: 'new@example.test', sub: 'new-account' });
    if (url.pathname.endsWith('/google_calendar_credentials')) {
      if (init?.method === 'POST') return new Response(null, { status: 201 });
      return Response.json([
        {
          provider_account_id: previousSubject,
          refresh_token: 'saved-refresh',
          access_token: 'saved-access',
          expires_at: '2099-01-01',
        },
      ]);
    }
    if (url.pathname.endsWith('/drive_connections')) {
      if (init?.method === 'PATCH') return new Response(null, { status: 204 });
      return Response.json([
        {
          id: '10000000-0000-4000-8000-000000000003',
          credential_key: `${actor}:${company}`,
          account_email: 'old@example.test',
          google_account_id: 'old-account',
          root_folder_id: 'old-folder',
          root_folder_name: 'CALI Workspace',
          status: 'connected',
        },
      ]);
    }
    if (copyTransport) return copyTransport(input, init);
    return Response.json({ message: 'Rota inesperada' }, { status: 500 });
  });
  const handle = createDriveHandler(
    {
      project: 'https://supabase.example.test',
      anon: 'public-fixture',
      service: 'service-fixture',
      clientId: 'drive-fixture',
      clientSecret: 'oauth-fixture',
      redirectUri: `${origin}/oauth/google/callback`,
      origins: [origin],
    },
    transport,
  );
  const send = (body: object) =>
    handle(
      new Request(`${origin}/functions/v1/google-drive-oauth`, {
        method: 'POST',
        headers: { origin, authorization: 'Bearer session-fixture' },
        body: JSON.stringify(body),
      }),
    );
  async function exchange() {
    const authorize = await send({ action: 'authorize' });
    expect(authorize.status).toBe(200);
    const { url } = await authorize.json();
    return send({
      action: 'exchange',
      code: 'test-code',
      state: new URL(url).searchParams.get('state'),
    });
  }
  return { transport, exchange, send };
}

it('recusa a troca de conta sem renovação própria e preserva a conexão anterior', async () => {
  const { exchange, transport } = setup();
  const response = await exchange();

  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'google_refresh_token_missing' });
  expect(
    transport.mock.calls.some(
      ([url, init]) =>
        String(url).includes('/rest/v1/') &&
        ['POST', 'PATCH'].includes(init?.method ?? '') &&
        !String(url).includes('/rpc/'),
    ),
  ).toBe(false);
});

it('guarda a credencial da nova conta em chave própria e limpa o destino anterior', async () => {
  const { exchange, transport } = setup({ refresh: true });

  expect((await exchange()).status).toBe(200);
  const key = `drive:${actor}:${company}:new-account`;
  const credential = transport.mock.calls.find(
    ([url, init]) =>
      String(url).includes('/google_calendar_credentials') && init?.method === 'POST',
  );
  expect(credential?.[1]?.body).toEqual(expect.any(String));
  expect(JSON.parse(String(credential?.[1]?.body))).toMatchObject({
    credential_key: key,
    provider_account_id: 'new-account',
    refresh_token: 'new-refresh',
  });
  const connection = transport.mock.calls.find(
    ([url, init]) => String(url).includes('/drive_connections') && init?.method === 'PATCH',
  );
  expect(JSON.parse(String(connection?.[1]?.body))).toMatchObject({
    credential_key: key,
    google_account_id: 'new-account',
    root_folder_id: null,
  });
});

it('impede cópia quando a credencial pertence a uma conta Google diferente da conexão', async () => {
  const { send, transport } = setup({ previousSubject: 'different-account' });

  const result = await send({
    action: 'copy_file',
    fileId: '10000000-0000-4000-8000-000000000004',
  });

  expect(result.status).toBe(400);
  expect(transport.mock.calls.every(([url]) => String(url).includes('supabase.example.test'))).toBe(
    true,
  );
});

it('retoma pasta com falha parcial, preservando a cópia já concluída', async () => {
  const deliverableId = '10000000-0000-4000-8000-000000000010';
  const first = '10000000-0000-4000-8000-000000000011';
  const second = '10000000-0000-4000-8000-000000000012';
  const lease = '10000000-0000-4000-8000-000000000013';
  const completed = new Map<string, string>();
  const uploads: string[] = [];
  const copyTransport: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname.endsWith('/rpc/v2_drive_copy')) {
      const { p_action, p_file, p_account } = JSON.parse(String(init?.body));
      expect(p_account).toBe('old-account');
      if (p_action === 'claim') {
        if (completed.has(p_file)) return Response.json({ done: true, url: completed.get(p_file) });
        return Response.json({
          done: false,
          lease,
          providerId: `drive-item-${p_file.slice(-2)}`,
          path: `${p_file}.pdf`,
          name: `${p_file}.pdf`,
          fileType: 'application/pdf',
          deliverable: deliverableId,
        });
      }
      if (p_action === 'complete') {
        const link = `https://drive.google.com/file/d/drive-item-${p_file.slice(-2)}/view`;
        completed.set(p_file, link);
        return Response.json({ done: true, url: link });
      }
      return Response.json({ done: false });
    }
    if (url.pathname === '/rest/v1/files') return Response.json([{ id: first }, { id: second }]);
    if (url.pathname === '/rest/v1/deliverables')
      return Response.json({ title: 'Entrega de teste', protocol: 'QA' });
    if (url.pathname.startsWith('/storage/v1/'))
      return new Response('arquivo sintético', { headers: { 'Content-Type': 'application/pdf' } });
    if (url.pathname.endsWith('/old-folder')) return Response.json({ id: 'old-folder' });
    if (url.pathname.includes('/drive/v3/files/drive-item-'))
      return new Response(null, { status: 404 });
    if (url.pathname === '/drive/v3/files') return Response.json({ files: [{ id: 'folder-qa' }] });
    if (url.pathname === '/upload/drive/v3/files' && init?.body instanceof Blob) {
      const body = await init.body.text();
      expect(body).toContain('"parents":["folder-qa"]');
      const item = body.includes(first) ? first : second;
      uploads.push(item);
      if (item === second && uploads.length === 2) return new Response(null, { status: 503 });
      return Response.json({ id: `drive-item-${item.slice(-2)}` });
    }
    return new Response(null, { status: 500 });
  };
  const { send } = setup({ copyTransport });
  const copyFolder = () => send({ action: 'copy_folder', deliverableId });

  expect(await (await copyFolder()).json()).toMatchObject({
    status: 'partial',
    copied: 1,
    failed: 1,
  });
  expect(await (await copyFolder()).json()).toEqual({
    status: 'synced',
    copied: 2,
    failed: 0,
    url: 'https://drive.google.com/drive/folders/folder-qa',
  });
  expect(uploads).toEqual([first, second, second]);
});
