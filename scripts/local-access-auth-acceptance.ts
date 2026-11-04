import { execFileSync } from 'node:child_process';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { validateLocalContainer } from './local-database.ts';
import { issuedSessionSchema } from '../supabase/functions/workspace-access/session-exchange.ts';

const root = resolve(import.meta.dirname, '..');
const network = 'cali-workspace-v2-isolated';
const suffix = randomUUID().slice(0, 8);
const database = `cali_session_cut_20261101_${suffix}`;
const source = 'supabase_db_cali-workspace-v2-local';
const auth = `cali-qa-auth-${suffix}`;
const rest = `cali-qa-rest-${suffix}`;
const mail = `cali-qa-mail-${suffix}`;
const gateway = `cali-qa-gateway-${suffix}`;
const edgeRuntime = `cali-qa-edge-${suffix}`;
const secret = randomBytes(48).toString('hex');
const services: string[] = [];
let createdDatabase = false;
let runtimeDirectory: string | undefined;
let stage = 'preflight';
let checks = 0;

function docker(args: string[], input?: string, env?: Record<string, string>) {
  return execFileSync('docker', args, {
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 30_000,
    env: env ? { ...process.env, ...env } : undefined,
  }).trim();
}
function sql(text: string, db = database) {
  try {
    return docker(
      ['exec', '-i', source, 'psql', '-XqAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', db],
      text,
    );
  } catch (error) {
    const failure = z.object({ stderr: z.string() }).safeParse(error);
    const detail =
      failure.success && failure.data.stderr.split('\n').find((line) => line.startsWith('ERROR:'));
    throw new Error(detail || 'psql falhou na cópia isolada', { cause: error });
  }
}
function file(path: string) {
  return readFileSync(resolve(root, path), 'utf8');
}
function check(value: boolean, label: string) {
  stage = label;
  if (!value) throw new Error(label);
  checks++;
  process.stdout.write(`OK ${label}\n`);
}
const topology = z.object({
  State: z.object({ Running: z.boolean() }),
  Config: z.object({ Env: z.array(z.string()), Labels: z.record(z.string(), z.string()) }),
  NetworkSettings: z.object({
    Networks: z.record(z.string(), z.object({ IPAddress: z.string() })),
    Ports: z.record(
      z.string(),
      z.array(z.object({ HostIp: z.string(), HostPort: z.string() })).nullable(),
    ),
  }),
});
function inspect(name: string) {
  return topology.parse(JSON.parse(docker(['inspect', name, '--format', '{{json .}}'])));
}
function envOf(name: string) {
  return Object.fromEntries(
    inspect(name).Config.Env.map((entry) => {
      const separator = entry.indexOf('=');
      return [entry.slice(0, separator), entry.slice(separator + 1)];
    }),
  );
}
function start(
  name: string,
  image: string,
  env: Record<string, string>,
  options: string[] = [],
  command: string[] = [],
) {
  docker(
    [
      'run',
      '-d',
      '--pull=never',
      '--name',
      name,
      '--network',
      network,
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges:true',
      ...options,
      ...Object.keys(env).flatMap((key) => ['--env', key]),
      image,
      ...command,
    ],
    undefined,
    env,
  );
  services.push(name);
  const info = inspect(name);
  check(
    info.State.Running &&
      Object.keys(info.NetworkSettings.Networks).join() === network &&
      Object.values(info.NetworkSettings.Ports).every((bindings) => !bindings?.length),
    `serviço isolado ${name.split('-')[2]}`,
  );
  return z.ipv4().parse(info.NetworkSettings.Networks[network]?.IPAddress);
}

function token(role: 'service_role' | 'anon') {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const raw = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    role,
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}`;
  return `${raw}.${createHmac('sha256', secret).update(raw).digest('base64url')}`;
}
const serviceKey = token('service_role');
const anonKey = token('anon');
function http(host: string, path: string, authToken = anonKey, body?: object, origin?: string) {
  const config = [
    `url = ${JSON.stringify(`http://${host}${path}`)}`,
    'silent',
    'show-error',
    'max-time = 8',
    `header = ${JSON.stringify(`Authorization: Bearer ${authToken}`)}`,
    'header = "Content-Type: application/json"',
    'header = "Accept-Profile: cali_workspace"',
    'header = "Content-Profile: cali_workspace"',
    'write-out = "\\n%{http_code}"',
  ];
  if (origin) config.push(`header = ${JSON.stringify(`Origin: ${origin}`)}`);
  if (body) config.push(`data = ${JSON.stringify(JSON.stringify(body))}`);
  const raw = docker(['exec', '-i', source, 'curl', '--config', '-'], config.join('\n'));
  const split = raw.lastIndexOf('\n');
  const bodyText = raw.slice(0, split);
  return { status: Number(raw.slice(split + 1)), bodyText };
}
function edge(body?: object) {
  return http(
    `${edgeRuntime}:9000`,
    '/functions/v1/workspace-access',
    anonKey,
    body,
    'http://127.0.0.1:5173',
  );
}
function rpc(name: string, body: object, authToken = serviceKey): unknown {
  const response = http(`${rest}:3000`, `/rpc/${name}`, authToken, body);
  if (response.status >= 300) {
    const result = z
      .object({ code: z.string().regex(/^(?:[0-9A-Z]{5}|PGRST\d{3})$/) })
      .safeParse(JSON.parse(response.bodyText || 'null'));
    throw new Error(
      `RPC ${name} HTTP ${response.status}${result.success ? ` ${result.data.code}` : ''}`,
    );
  }
  return JSON.parse(response.bodyText || 'null');
}
function authCall(path: string, body?: object, authToken = anonKey) {
  return http(`${auth}:9999`, path, authToken, body);
}
const ids = z.object({ id: z.uuid() });
const tokens = issuedSessionSchema.pick({ access_token: true, refresh_token: true });
const jwtClaims = z.object({ session_id: z.uuid(), aal: z.string() });
const capturedIds = new Set<string>();
function claims(accessToken: string) {
  return jwtClaims.parse(
    JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString()),
  );
}
async function captured(email: string, subject: string) {
  const messages = z.object({
    messages: z.array(
      z.object({
        ID: z.string(),
        Subject: z.string(),
        To: z.array(z.object({ Address: z.string() })),
      }),
    ),
  });
  for (let attempt = 0; attempt < 12; attempt++) {
    const response = http(`${mail}:8025`, '/api/v1/messages');
    const list = messages.parse(JSON.parse(response.bodyText));
    const match = list.messages.find(
      (item) =>
        !capturedIds.has(item.ID) &&
        item.Subject === subject &&
        item.To.some((to) => to.Address === email),
    );
    if (match) {
      capturedIds.add(match.ID);
      return z
        .object({ Text: z.string(), HTML: z.string() })
        .parse(
          JSON.parse(
            http(`${mail}:8025`, `/api/v1/message/${encodeURIComponent(match.ID)}`).bodyText,
          ),
        );
    }
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error('Mensagem sintética não capturada.');
}
function readProfile(session: z.infer<typeof tokens>, id: string) {
  const response = http(`${rest}:3000`, `/profiles?select=id&id=eq.${id}`, session.access_token);
  return response.status === 200 ? z.array(ids).parse(JSON.parse(response.bodyText)).length : -1;
}

async function main() {
  if (process.argv[2] !== '--run') throw new Error('Use --run.');
  const endpoint =
    process.env.DOCKER_HOST ||
    docker(['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}']);
  if (!endpoint.startsWith('unix://')) throw new Error('Docker remoto não permitido.');
  const db = inspect(source);
  validateLocalContainer({
    running: db.State.Running,
    labels: db.Config.Labels,
    networks: db.NetworkSettings.Networks,
    ports: db.NetworkSettings.Ports,
  });
  check(
    docker(['network', 'inspect', network, '--format', '{{.Internal}}']) === 'true',
    'rede sem saída externa',
  );

  stage = 'criar cópia de schema local';
  sql(`create database ${database};`, 'postgres');
  createdDatabase = true;
  const dump = (args: string[]) =>
    docker(['exec', source, 'pg_dump', '-U', 'postgres', '-d', 'postgres', ...args]);
  sql(
    dump([
      '--schema-only',
      '--no-owner',
      '--no-privileges',
      '--schema=auth',
      '--schema=extensions',
    ]),
  );
  sql(dump(['--data-only', '--table=auth.schema_migrations']));
  sql('grant usage on schema auth to anon, authenticated, service_role;');
  check(sql('select count(*) from auth.users;') === '0', 'cópia sem usuários anteriores');

  stage = 'preparar contratos isolados';
  sql(file('tests/fixtures/session-cut/reference.sql'));
  sql(`alter table cali_workspace.companies
    add column automation_enabled boolean default false,
    add column welcome_email_enabled boolean default false,
    add column due_reminder_enabled boolean default false,
    add column overdue_email_enabled boolean default false,
    add column termination_email_enabled boolean default false;
    create schema storage;
    create table storage.objects (id uuid primary key, bucket_id text, name text, version text, archived_at timestamptz, is_delete_marker boolean);
    create table cali_workspace.account_documents (id uuid primary key, company_id uuid, title text, document_type text, storage_path text);
    create schema cali_private;
    create table cali_workspace.workspace_adhesions(company_id uuid primary key);
    drop table cali_workspace.terms_acceptances;
    alter policy profiles_self_select on cali_workspace.profiles rename to profiles_self_read;`);
  stage = 'aplicar códigos e termos locais';
  sql(file('supabase/migrations/20261029120000_codes_terms.sql'));
  const onboarding = 'supabase/proposals/company-onboarding';
  for (const name of [
    'candidate',
    'materialize-company',
    'link-adhesion-document',
    'access-eligibility',
  ]) {
    stage = `aplicar ${name} de empresas`;
    sql(file(`${onboarding}/${name}.sql`));
  }
  const review =
    "set cali.session_cut_review='reviewed-v1'; set cali.session_cut_test='isolated-only';";
  for (const name of ['candidate', 'reconciliation', 'login-admission', 'local-code-admission']) {
    stage = `aplicar ${name} de sessão`;
    sql(`${review}\n${file(`supabase/proposals/session-cut/${name}.sql`)}`);
  }
  stage = 'aplicar gestão de acessos';
  sql(`${review}\n${file(`${onboarding}/manage-access.sql`)}`);

  stage = 'iniciar serviços descartáveis';
  const password = z.string().min(1).parse(envOf(source).POSTGRES_PASSWORD);
  const dsn = new URL(`postgresql://postgres@${source}:5432/${database}`);
  dsn.password = password;
  dsn.searchParams.set('search_path', 'auth');
  const restDsn = new URL(
    z.string().parse(envOf('supabase_rest_cali-workspace-v2-local').PGRST_DB_URI),
  );
  restDsn.hostname = source;
  restDsn.pathname = `/${database}`;
  const mailAddress = start(mail, 'public.ecr.aws/supabase/mailpit:v1.31.3', {});
  start(auth, 'public.ecr.aws/supabase/gotrue:v2.197.0', {
    API_EXTERNAL_URL: `http://${auth}:9999`,
    GOTRUE_API_HOST: '0.0.0.0',
    GOTRUE_API_PORT: '9999',
    GOTRUE_DB_DRIVER: 'postgres',
    GOTRUE_DB_DATABASE_URL: dsn.toString(),
    GOTRUE_DB_DB_NAMESPACE: 'auth',
    GOTRUE_SITE_URL: 'http://127.0.0.1:5173',
    GOTRUE_JWT_SECRET: secret,
    GOTRUE_JWT_ADMIN_ROLES: 'service_role',
    GOTRUE_JWT_AUD: 'authenticated',
    GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated',
    GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true',
    GOTRUE_SMTP_HOST: mail,
    GOTRUE_SMTP_PORT: '1025',
    GOTRUE_SMTP_ADMIN_EMAIL: 'workspace@example.test',
    GOTRUE_MAILER_SUBJECTS_INVITE: 'Convite CALI QA',
  });
  start(rest, 'public.ecr.aws/supabase/postgrest:v16.5', {
    PGRST_DB_URI: restDsn.toString(),
    PGRST_DB_SCHEMAS: 'cali_workspace',
    PGRST_DB_ANON_ROLE: 'anon',
    PGRST_JWT_SECRET: secret,
  });
  stage = 'montar gateway e bundle Edge';
  const bundle = resolve(root, 'supabase/.temp/workspace-access');
  readFileSync(resolve(bundle, 'index.ts'));
  runtimeDirectory = mkdtempSync(resolve(root, 'supabase/.temp/cali-access-qa-'));
  const kongConfig = resolve(runtimeDirectory, 'kong.json');
  writeFileSync(
    kongConfig,
    JSON.stringify({
      _format_version: '1.1',
      services: [
        { name: 'auth', url: `http://${auth}:9999`, routes: [{ paths: ['/auth/v1'] }] },
        { name: 'rest', url: `http://${rest}:3000`, routes: [{ paths: ['/rest/v1'] }] },
      ],
    }),
  );
  const gatewayAddress = start(
    gateway,
    'public.ecr.aws/supabase/kong:2.8.1',
    { KONG_DATABASE: 'off', KONG_DECLARATIVE_CONFIG: '/qa/kong.json', KONG_ADMIN_LISTEN: 'off' },
    ['--mount', `type=bind,src=${kongConfig},dst=/qa/kong.json,readonly`],
  );
  start(
    edgeRuntime,
    'public.ecr.aws/supabase/edge-runtime:v1.77.8',
    { SUPABASE_URL: 'http://kong:8000', SUPABASE_SERVICE_ROLE_KEY: serviceKey },
    [
      '--add-host',
      `kong:${gatewayAddress}`,
      '--add-host',
      `supabase_inbucket_cali-workspace-v2-local:${mailAddress}`,
      '--mount',
      `type=bind,src=${bundle},dst=/qa/function,readonly`,
    ],
    ['start', '--main-service', '/qa/function'],
  );
  stage = 'aguardar gateway e runtime Edge';
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      if (
        http(`${gateway}:8000`, '/auth/v1/health').status === 200 &&
        http(`${gateway}:8000`, '/rest/v1/', serviceKey).status === 200 &&
        edge().status === 405
      )
        break;
    } catch {
      // Aguarda as duas portas internas.
    }
    if (attempt === 14) throw new Error('Serviços indisponíveis.');
    await new Promise((done) => setTimeout(done, 500));
  }
  check(true, 'bundle Edge ativo com gateway isolado');

  const adminEmail = `admin-${suffix}@example.test`;
  const adminPassword = `QA-${randomUUID()}!`;
  const adminResponse = authCall(
    '/admin/users',
    { email: adminEmail, password: adminPassword, email_confirm: true },
    serviceKey,
  );
  check(adminResponse.status === 200, 'Admin criado no Auth local');
  const adminId = ids.parse(JSON.parse(adminResponse.bodyText)).id;
  sql(
    `insert into cali_workspace.profiles(id,email,full_name,role) values ('${adminId}','${adminEmail}','Admin QA','admin');`,
  );
  const login = authCall('/token?grant_type=password', {
    email: adminEmail,
    password: adminPassword,
  });
  check(login.status === 200, 'Admin autenticado no Auth local');
  const admin = tokens.parse(JSON.parse(login.bodyText));
  const enrolled = authCall(
    '/factors',
    { factor_type: 'totp', friendly_name: 'CALI QA' },
    admin.access_token,
  );
  check(enrolled.status === 200, 'fator TOTP sintético criado');
  const factor = z
    .object({ id: z.uuid(), totp: z.object({ secret: z.string() }) })
    .parse(JSON.parse(enrolled.bodyText));
  const challenge = authCall(`/factors/${factor.id}/challenge`, {}, admin.access_token);
  check(challenge.status === 200, 'desafio TOTP criado');
  const challengeId = ids.parse(JSON.parse(challenge.bodyText)).id;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...factor.totp.secret.toUpperCase().replace(/=+$/, '')]
    .map((letter) => alphabet.indexOf(letter).toString(2).padStart(5, '0'))
    .join('');
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((part) => parseInt(part, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const mac = createHmac('sha1', key).update(counter).digest();
  const offset = mac[mac.length - 1] & 15;
  const code = String((mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
  const verified = authCall(
    `/factors/${factor.id}/verify`,
    { challenge_id: challengeId, code },
    admin.access_token,
  );
  check(verified.status === 200, 'TOTP Admin verificado pelo Auth');
  const adminSession = tokens.parse(JSON.parse(verified.bodyText));
  check(claims(adminSession.access_token).aal === 'aal2', 'JWT real com AAL2');

  stage = 'preparar empresa com adesão';
  const draftId = ids.parse(
    rpc(
      'v2_create_company_draft',
      {
        p_request_id: randomUUID(),
        p_display_name: 'Empresa Auth QA',
        p_legal_name: 'Empresa Auth QA',
      },
      adminSession.access_token,
    ),
  ).id;
  const company = z
    .uuid()
    .parse(rpc('v2_materialize_company', { p_draft_id: draftId }, adminSession.access_token));
  const documentId = randomUUID();
  const objectId = randomUUID();
  sql(`insert into cali_workspace.account_documents values ('${documentId}','${company}','Contrato QA','contract','${company}/account/qa.pdf');
    insert into storage.objects values ('${objectId}','cali-workspace-private','${company}/account/qa.pdf','v1',null,false);
    insert into cali_workspace.workspace_adhesions values ('${company}');
    update cali_v2_onboarding.company_drafts set access_management_enabled=true where id='${draftId}';`);
  rpc(
    'v2_confirm_adhesion_document',
    {
      p_draft_id: draftId,
      p_request_id: randomUUID(),
      p_expected_event_id: null,
      p_reference: 'QA',
      p_note: 'Conferência sintética',
      p_document_id: documentId,
      p_object_id: objectId,
      p_version: 'v1',
    },
    adminSession.access_token,
  );

  const manage = (
    action: 'invite' | 'revoke' | 'reactivate',
    inviteId: string | null,
    email: string | null,
  ) =>
    z.uuid().parse(
      rpc(
        'v2_manage_company_access',
        {
          p_company_id: company,
          p_request_id: randomUUID(),
          p_action: action,
          p_invite_id: inviteId,
          p_email: email,
          p_full_name: email ? 'Pessoa QA' : null,
        },
        adminSession.access_token,
      ),
    );
  async function invite(label: string) {
    const email = `acesso-${label}-${suffix}@example.test`;
    const inviteId = manage('invite', null, email);
    const issued = authCall('/invite', { email }, serviceKey);
    check(issued.status === 200, `Auth emitiu convite ${label}`);
    const id = ids.parse(JSON.parse(issued.bodyText)).id;
    const message = await captured(email, 'Convite CALI QA');
    check(/type=invite/.test(message.HTML), `Mailpit recebeu convite ${label}`);
    sql(`insert into cali_workspace.profiles(id,company_id,email,full_name,role)
      values('${id}','${company}','${email}','Pessoa QA','client');`);
    return { email, id, inviteId };
  }
  const a = await invite('a');
  const b = await invite('b');

  function issueAuthHash(email: string) {
    const link = authCall('/admin/generate_link', { type: 'magiclink', email }, serviceKey);
    if (link.status !== 200) throw new Error(`Auth generate_link HTTP ${link.status}`);
    return z.object({ hashed_token: z.string() }).parse(JSON.parse(link.bodyText)).hashed_token;
  }

  function exchangeAuthHash(hash: string) {
    return authCall('/verify', { token_hash: hash, type: 'email' });
  }

  const directAuth = exchangeAuthHash(issueAuthHash(a.email));
  check(directAuth.status === 200, 'Auth emitiu sessão direta antes do primeiro login');
  const unadmitted = tokens.parse(JSON.parse(directAuth.bodyText));
  check(readProfile(unadmitted, a.id) === 0, 'primeira sessão sem admissão não passou pela RLS');

  async function startLogin(email: string) {
    const requested = edge({ action: 'request', email });
    check(
      requested.status === 200 &&
        z.object({ challenge: z.literal('code') }).safeParse(JSON.parse(requested.bodyText))
          .success,
      'Edge solicitou código',
    );
    const message = await captured(email, 'CALI laboratório · Código de acesso');
    return z
      .string()
      .regex(/^\d{6}$/)
      .parse(message.Text.match(/código de teste é (\d{6})/)?.[1]);
  }
  function finishLogin(email: string, otp: string) {
    const response = edge({ action: 'verify', email, code: otp });
    check(response.status === 200, 'Edge trocou código e admitiu sessão Auth');
    return z.object({ session: tokens }).parse(JSON.parse(response.bodyText)).session;
  }
  const sessionA = finishLogin(a.email, await startLogin(a.email));
  const sessionB = finishLogin(b.email, await startLogin(b.email));
  check(
    readProfile(sessionA, a.id) === 1 && readProfile(sessionB, b.id) === 1,
    'JWTs admitidos leem o perfil pelo PostgREST',
  );

  // Só a janela de emissão de código da fixture é avançada para criar a prova pendente.
  sql(
    `update cali_private.workspace_access_codes set created_at=clock_timestamp()-interval '3 minutes' where email='${a.email}';`,
  );
  const oldCode = await startLogin(a.email);
  const pendingHash = issueAuthHash(a.email);
  manage('revoke', a.inviteId, null);
  check(
    readProfile(sessionA, a.id) === 0 && readProfile(sessionB, b.id) === 1,
    'revogação corta A e preserva B',
  );
  const renewed = authCall('/token?grant_type=refresh_token', {
    refresh_token: sessionA.refresh_token,
  });
  const refreshed = renewed.status === 200 ? tokens.parse(JSON.parse(renewed.bodyText)) : null;
  if (refreshed) {
    check(
      claims(refreshed.access_token).session_id === claims(sessionA.access_token).session_id &&
        readProfile(refreshed, a.id) === 0,
      'refresh real não recupera acesso',
    );
  } else {
    check(renewed.status >= 400 && renewed.status < 500, 'Auth recusou refresh da sessão revogada');
  }
  manage('reactivate', a.inviteId, null);
  check(
    readProfile(sessionA, a.id) === 0 && (!refreshed || readProfile(refreshed, a.id) === 0),
    'reativação mantém JWTs da sessão antiga cortados',
  );
  const lateAuth = exchangeAuthHash(pendingHash);
  check(lateAuth.status === 200, 'Auth consumiu hash emitido antes do corte após reativação');
  const lateSession = tokens.parse(JSON.parse(lateAuth.bodyText));
  check(
    readProfile(lateSession, a.id) === 0,
    'sessão criada com hash pendente não passou pela RLS',
  );
  check(
    edge({ action: 'verify', email: a.email, code: oldCode }).status === 400,
    'código anterior ao corte recusado',
  );
  sql(
    `update cali_private.workspace_access_codes set created_at=clock_timestamp()-interval '3 minutes' where email='${a.email}';`,
  );
  const fresh = finishLogin(a.email, await startLogin(a.email));
  check(
    claims(fresh.access_token).session_id !== claims(sessionA.access_token).session_id &&
      readProfile(fresh, a.id) === 1 &&
      readProfile(sessionB, b.id) === 1,
    'código novo admite nova sessão e preserva B',
  );
  process.stdout.write(`Homologação local concluída com ${checks} verificações.\n`);
}

void main()
  .catch((error: unknown) => {
    const detail = error instanceof Error ? error.message.split('\n')[0] : 'falha inesperada';
    process.stderr.write(`Homologação interrompida em ${stage} (${detail}).\n`);
    process.exitCode = 1;
  })
  .finally(() => {
    const resources = services.reverse().map((name) => ({
      name,
      remove: () => docker(['rm', '-f', name]),
    }));
    if (createdDatabase)
      resources.push({
        name: database,
        remove: () => sql(`drop database ${database} with (force);`, 'postgres'),
      });
    if (runtimeDirectory) {
      const directory = runtimeDirectory;
      resources.push({
        name: directory,
        remove: () => {
          rmSync(directory, { recursive: true, force: true });
          return '';
        },
      });
    }
    for (const { name, remove } of resources) {
      try {
        remove();
      } catch {
        process.stderr.write(`Falha ao remover recurso descartável ${name}.\n`);
        process.exitCode = 1;
      }
    }
  });
