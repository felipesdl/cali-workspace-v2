import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { assertLocalDatabase, localSql } from './local-database.ts';
import {
  currentTermsSchema,
  workspaceAccessStateSchema,
} from '../src/api/modules/access/session.ts';

let stage = 'precondições';
let checks = 0;
function check(value: boolean, label: string) {
  stage = label;
  if (!value) throw new Error(label);
  checks += 1;
}
async function main() {
  assertLocalDatabase();
  const keys = z
    .object({
      API_URL: z.literal('http://127.0.0.1:56321'),
      ANON_KEY: z.string(),
      SERVICE_ROLE_KEY: z.string(),
    })
    .parse(
      JSON.parse(
        execFileSync('supabase', ['status', '-o', 'json'], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        }),
      ),
    );
  async function api(path: string, body?: object, token = keys.ANON_KEY, method?: string) {
    stage = path;
    return fetch(`${keys.API_URL}${path}`, {
      method: method ?? (body ? 'POST' : 'GET'),
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
      headers: {
        apikey: token === keys.SERVICE_ROLE_KEY ? token : keys.ANON_KEY,
        Authorization: `Bearer ${token}`,
        Origin: 'http://127.0.0.1:5173',
        'Content-Type': 'application/json',
        'Content-Profile': 'cali_workspace',
        'Accept-Profile': 'cali_workspace',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }
  const endpoint = '/functions/v1/workspace-access';
  const email = `code-${randomUUID()}@example.test`;
  const company = randomUUID();
  const other = randomUUID();
  const version1 = `local-code-${randomUUID().slice(0, 8)}-v1`;
  const version2 = version1.replace(/v1$/, 'v2');
  localSql(`insert into cali_workspace.companies(id,display_name,legal_name) values ('${company}','Códigos teste A','Códigos teste A'),('${other}','Códigos teste B','Códigos teste B');
    insert into cali_workspace.legal_versions(version,title,content) values ('${version1}','Teste sintético','Conteúdo sintético V1. Não usar em produção.'),('${version2}','Teste sintético','Conteúdo sintético V2. Não usar em produção.');
    insert into cali_private.current_legal_version(singleton,version) values(true,'${version1}') on conflict(singleton) do update set version=excluded.version;`);
  async function user(mail: string, role: 'admin' | 'client', companyId: string | null) {
    const response = await api(
      '/auth/v1/admin/users',
      { email: mail, email_confirm: true },
      keys.SERVICE_ROLE_KEY,
    );
    check(response.ok, 'preparar usuário sintético');
    const id = z.object({ id: z.uuid() }).parse(await response.json()).id;
    localSql(
      `insert into cali_workspace.profiles(id,company_id,role,active) values('${id}',${companyId ? `'${companyId}'` : 'null'},'${role}',true);`,
    );
    return id;
  }
  const adminEmail = `code-admin-${randomUUID()}@example.test`;
  const adminId = await user(adminEmail, 'admin', null);
  const userId = await user(email, 'client', company);
  localSql(
    `insert into cali_workspace.workspace_adhesions(company_id,evidence_reference,recorded_by) values('${company}','CALI-LOCAL-CODES: preparação sintética','${adminId}');`,
  );
  async function requestCode(mail = email) {
    return api(endpoint, { action: 'request', email: mail });
  }
  async function readCode(mail = email) {
    const response = await fetch('http://127.0.0.1:56324/api/v1/messages?limit=100', {
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
    });
    const list = z
      .object({
        messages: z.array(
          z.object({ ID: z.string(), To: z.array(z.object({ Address: z.string() })) }),
        ),
      })
      .parse(await response.json());
    const message = list.messages.find((item) =>
      item.To.some((recipient) => recipient.Address === mail),
    );
    if (!message) throw new Error('Mensagem local não localizada.');
    const full = await fetch(`http://127.0.0.1:56324/api/v1/message/${message.ID}`, {
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
    });
    const text = z.object({ Text: z.string() }).parse(await full.json()).Text;
    const code = text.match(/\b(\d{6})\b/)?.[1];
    if (!code) throw new Error('Código não localizado.');
    return code;
  }
  const verifyCode = (code: string, mail = email) =>
    api(endpoint, { action: 'verify', email: mail, code });
  const releaseThrottle = () =>
    localSql(
      `update cali_private.workspace_access_codes set created_at=clock_timestamp()-interval '3 minutes' where email='${email}';`,
    );
  async function login(mail = email) {
    check((await requestCode(mail)).ok, 'solicitar novo código');
    const verified = await verifyCode(await readCode(mail), mail);
    check(verified.ok, 'verificar novo código');
    const result = z.object({ token_hash: z.string() }).parse(await verified.json());
    const session = await api('/auth/v1/verify', { token_hash: result.token_hash, type: 'email' });
    check(session.ok, 'trocar hash por sessão Auth');
    return z.object({ access_token: z.string() }).parse(await session.json()).access_token;
  }
  async function state(token: string) {
    const response = await api('/rest/v1/rpc/workspace_access_state', {}, token);
    check(response.ok, 'consultar estado autorizado');
    return workspaceAccessStateSchema.parse(await response.json());
  }
  async function accept(token: string) {
    const legal = currentTermsSchema.parse(
      await (await api('/rest/v1/rpc/get_current_terms', {}, token)).json(),
    );
    const response = await api(
      '/rest/v1/rpc/accept_current_terms',
      { version: legal.version, contentHash: legal.contentHash },
      token,
    );
    check(response.ok, 'aceitar versão corrente');
    return response.json();
  }
  check(
    (await api(endpoint, { action: 'request', email, role: 'admin' })).status === 400,
    'campos de autoridade extras negados',
  );
  check(
    (await api(endpoint, { action: 'verify', email, code: '12' })).status === 400,
    'código parcial negado',
  );
  const unknown = await requestCode(`unknown-${randomUUID()}@example.test`);
  check(
    unknown.ok && JSON.stringify(await unknown.json()) === '{"ok":true}',
    'conta ausente recebe resposta genérica',
  );
  const burst = await Promise.all([requestCode(), requestCode(), requestCode()]);
  check(
    burst.filter((response) => response.status === 200).length === 1 &&
      burst.filter((response) => response.status === 429).length === 2,
    'solicitações concorrentes respeitam 120s',
  );
  const code = await readCode();
  const attempts = await Promise.all([verifyCode(code), verifyCode(code)]);
  check(
    attempts.filter((response) => response.ok).length === 1 &&
      attempts.filter((response) => response.status === 400).length === 1,
    'consumo concorrente permite um único vencedor',
  );
  const winner = attempts.find((response) => response.ok);
  if (!winner) throw new Error('Sem vencedor.');
  const tokenHash = z.object({ token_hash: z.string() }).parse(await winner.json()).token_hash;
  const exchanged = await api('/auth/v1/verify', { token_hash: tokenHash, type: 'email' });
  check(exchanged.ok, 'hash emitido pelo código cria sessão real');
  let token = z.object({ access_token: z.string() }).parse(await exchanged.json()).access_token;
  check(
    !(await api('/auth/v1/verify', { token_hash: tokenHash, type: 'email' })).ok,
    'hash Auth não é reutilizável',
  );
  check((await state(token)).status === 'terms_required', 'primeiro acesso exige termos');
  check(
    (await api('/rest/v1/companies', undefined, token)).ok,
    'consulta de empresas responde com RLS',
  );
  const before = z
    .array(z.object({ id: z.uuid() }))
    .parse(await (await api('/rest/v1/companies', undefined, token)).json());
  check(before.length === 0, 'sem aceite não lê empresas');
  check(
    (
      await api(
        '/rest/v1/rpc/accept_current_terms',
        { version: version1, contentHash: '0'.repeat(64) },
        token,
      )
    ).status === 400,
    'digest apresentado incorreto negado',
  );
  const receipt = await accept(token);
  check(
    JSON.stringify(await accept(token)) === JSON.stringify(receipt),
    'aceite repetido preserva instante original',
  );
  check((await state(token)).status === 'ready', 'aceite confirmado libera estado');
  const companies = z
    .array(z.object({ id: z.uuid() }))
    .parse(await (await api('/rest/v1/companies', undefined, token)).json());
  check(
    companies.length === 1 && companies[0].id === company,
    'Cliente só recebe a própria empresa',
  );
  check(
    !(await api('/rest/v1/terms_acceptances', { user_id: adminId, version: version1 }, token)).ok,
    'inserção direta/autoria alheia negada',
  );
  localSql(`update cali_private.current_legal_version set version='${version2}' where singleton;`);
  check(
    (await state(token)).status === 'terms_required',
    'versão nova invalida liberação anterior',
  );
  const current = currentTermsSchema.parse(
    await (await api('/rest/v1/rpc/get_current_terms', {}, token)).json(),
  );
  check(
    (
      await api(
        '/rest/v1/rpc/accept_current_terms',
        { version: version1, contentHash: current.contentHash },
        token,
      )
    ).status === 400,
    'versão antiga não aceita conteúdo novo',
  );
  await accept(token);
  localSql(`update cali_workspace.companies set status='paused' where id='${company}';`);
  check((await state(token)).status === 'ready', 'empresa pausada mantém consulta');
  localSql(`update cali_workspace.companies set status='blocked' where id='${company}';`);
  check((await state(token)).status === 'signed_out', 'bloqueio corta sessão vigente');
  localSql(`update cali_workspace.companies set status='active' where id='${company}';`);
  check((await state(token)).status === 'signed_out', 'reativação não recupera sessão antiga');
  releaseThrottle();
  token = await login();
  check((await state(token)).status === 'ready', 'novo código cria sessão com aceite preservado');
  releaseThrottle();
  check((await requestCode()).ok, 'preparar código antes de revogação');
  const pendingCode = await readCode();
  localSql(`update cali_workspace.profiles set active=false where id='${userId}';`);
  check((await verifyCode(pendingCode)).status === 400, 'revogação invalida código pendente');
  localSql(`update cali_workspace.profiles set active=true where id='${userId}';`);
  check(
    (await verifyCode(pendingCode)).status === 400,
    'reativação não recupera código consumido/revogado',
  );
  releaseThrottle();
  token = await login();
  check((await api('/auth/v1/logout', {}, token)).ok, 'logout Auth local');
  check(
    (await state(token)).status === 'signed_out',
    'JWT anterior ao logout não libera workspace',
  );
  releaseThrottle();
  check((await requestCode()).ok, 'preparar código para limite de tentativas');
  const limitedCode = await readCode();
  const wrong = String((Number(limitedCode) + 1) % 1000000).padStart(6, '0');
  for (let attempt = 0; attempt < 5; attempt++)
    check((await verifyCode(wrong)).status === 400, 'tentativa incorreta negada');
  check(
    (await verifyCode(limitedCode)).status === 400,
    'quinta falha encerra uso do código correto',
  );
  releaseThrottle();
  check((await requestCode()).ok, 'preparar código expirado');
  const expiredCode = await readCode();
  localSql(
    `update cali_private.workspace_access_codes set created_at=clock_timestamp()-interval '11 minutes',expires_at=clock_timestamp()-interval '1 minute' where email='${email}' and used_at is null;`,
  );
  check((await verifyCode(expiredCode)).status === 400, 'código expirado negado');
  for (const status of ['closed', 'archived']) {
    releaseThrottle();
    token = await login();
    localSql(`update cali_workspace.companies set status='${status}' where id='${company}';`);
    check((await state(token)).status === 'signed_out', `empresa ${status} corta sessão`);
    localSql(`update cali_workspace.companies set status='active' where id='${company}';`);
  }
  releaseThrottle();
  token = await login();
  localSql(
    `update auth.sessions set not_after=clock_timestamp()-interval '1 minute' where user_id='${userId}';`,
  );
  check(
    (await state(token)).status === 'signed_out',
    'sessão expirada não libera mesmo com JWT ainda válido',
  );
  const adminToken = await login(adminEmail);
  check(
    (await state(adminToken)).status === 'mfa_required',
    'Admin por código continua exigindo MFA',
  );
  check(
    (
      await api(
        '/rest/v1/rpc/accept_current_terms',
        { version: current.version, contentHash: current.contentHash },
        adminToken,
      )
    ).status === 403,
    'Admin não aceita/libera antes do segundo fator',
  );
  check(
    localSql(`select count(*) from cali_workspace.terms_acceptances where user_id='${userId}';`) ===
      '2',
    'histórico dos dois aceites preservado',
  );
  process.stdout.write(
    `Códigos/termos/sessão: ${checks} verificações API locais passaram; fixtures sintéticas preservadas.\n`,
  );
}
void main().catch(() => {
  process.stderr.write(`Teste local falhou na etapa: ${stage}; valores/segredos omitidos.\n`);
  process.exitCode = 1;
});
