import { execFileSync } from 'node:child_process';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { workspaceAdhesionRecordSchema } from '../src/api/modules/access/adhesion.ts';
import { assertLocalDatabase, localSql } from './local-database.ts';

// Driver exclusivo do laboratório; nenhuma chave/token/segredo é escrito ou impresso.
let stage = 'precondições';
let checks = 0;
function check(value: boolean, label: string) {
  stage = label;
  if (!value) throw new Error(label);
  checks += 1;
}

function totp(secret: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...secret.toUpperCase().replace(/=+$/, '')]
    .map((character) => alphabet.indexOf(character).toString(2).padStart(5, '0'))
    .join('');
  const key = Buffer.from(bits.match(/.{8}/g)?.map((byte) => parseInt(byte, 2)) ?? []);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const hash = createHmac('sha1', key).update(counter).digest();
  const offset = hash[hash.length - 1] & 15;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

async function main() {
  assertLocalDatabase();
  const keys = z
    .object({
      API_URL: z.literal('http://127.0.0.1:56321'),
      ANON_KEY: z.string().min(1),
      SERVICE_ROLE_KEY: z.string().min(1),
    })
    .parse(
      JSON.parse(
        execFileSync('supabase', ['status', '-o', 'json'], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 10_000,
        }),
      ),
    );
  async function request(path: string, token: string, body?: object, method?: string) {
    stage = path;
    return fetch(`${keys.API_URL}${path}`, {
      method: method ?? (body ? 'POST' : 'GET'),
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      headers: {
        apikey: token === keys.SERVICE_ROLE_KEY ? keys.SERVICE_ROLE_KEY : keys.ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept-Profile': 'cali_workspace',
        'Content-Profile': 'cali_workspace',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }
  const password = randomBytes(24).toString('base64url');
  const signup = await request('/auth/v1/signup', keys.ANON_KEY, {
    email: `signup-negado-${randomUUID()}@example.test`,
    password,
  });
  check(!signup.ok, 'signup público continua bloqueado');
  async function actor(role: 'admin' | 'client', companyId: string | null) {
    const email = `local-${role}-${randomUUID()}@example.test`;
    const created = await request('/auth/v1/admin/users', keys.SERVICE_ROLE_KEY, {
      email,
      password,
      email_confirm: true,
    });
    check(created.ok, 'criação de ator sintético pelo Auth local');
    const user = z.object({ id: z.uuid() }).parse(await created.json());
    localSql(
      `insert into cali_workspace.profiles(id, company_id, role, active) values ('${user.id}', ${companyId ? `'${companyId}'` : 'null'}, '${role}', true);`,
    );
    const login = await request('/auth/v1/token?grant_type=password', keys.ANON_KEY, {
      email,
      password,
    });
    check(login.ok, 'primeiro fator local');
    const session = z.object({ access_token: z.string().min(1) }).parse(await login.json());
    return { id: user.id, token: session.access_token };
  }
  localSql(`insert into cali_workspace.legal_versions(version,title,content) values ('local-adhesion-api','Teste sintético','Documento sintético, não é termo de produção.') on conflict do nothing;
    insert into cali_private.current_legal_version(singleton,version) values(true,'local-adhesion-api') on conflict do nothing;`);
  const companyA = randomUUID();
  const companyB = randomUUID();
  localSql(
    `insert into cali_workspace.companies(id, display_name, legal_name) values ('${companyA}', 'Laboratório A API', 'Laboratório A API'), ('${companyB}', 'Laboratório B API', 'Laboratório B API');`,
  );
  const admin = await actor('admin', null);
  const payload = {
    companyId: companyA,
    evidenceReference: 'CALI-LOCAL-API: referência sintética',
  };
  const rpc = '/rest/v1/rpc/register_workspace_adhesion';
  check((await request(rpc, admin.token, payload)).status === 403, 'Admin AAL1 sem fator negado');
  const enrollment = await request('/auth/v1/factors', admin.token, {
    factor_type: 'totp',
    friendly_name: 'CALI laboratório',
  });
  check(enrollment.ok, 'cadastro TOTP local');
  const factor = z
    .object({ id: z.uuid(), totp: z.object({ secret: z.string().regex(/^[A-Z2-7]+=*$/i) }) })
    .parse(await enrollment.json());
  check(
    (await request(rpc, admin.token, payload)).status === 403,
    'fator cadastrado sem confirmação não libera',
  );
  async function challenge() {
    const response = await request(`/auth/v1/factors/${factor.id}/challenge`, admin.token, {});
    check(response.ok, 'challenge TOTP');
    return z.object({ id: z.uuid() }).parse(await response.json()).id;
  }
  const invalidCode = String((Number(totp(factor.totp.secret)) + 1) % 1_000_000).padStart(6, '0');
  const invalid = await request(`/auth/v1/factors/${factor.id}/verify`, admin.token, {
    challenge_id: await challenge(),
    code: invalidCode,
  });
  check(!invalid.ok, 'código TOTP incorreto negado');
  check((await request(rpc, admin.token, payload)).status === 403, 'falha de MFA mantém bloqueio');
  const verified = await request(`/auth/v1/factors/${factor.id}/verify`, admin.token, {
    challenge_id: await challenge(),
    code: totp(factor.totp.secret),
  });
  check(verified.ok, 'segundo fator validado pelo Auth local');
  const session = z.object({ access_token: z.string().min(1) }).parse(await verified.json());
  const legalResponse = await request('/rest/v1/rpc/get_current_terms', session.access_token, {});
  const legal = z
    .object({ version: z.string(), contentHash: z.string() })
    .parse(await legalResponse.json());
  check(
    (await request('/rest/v1/rpc/accept_current_terms', session.access_token, legal)).ok,
    'aceite corrente antes da operação Admin',
  );
  const response = await request(rpc, session.access_token, payload);
  check(response.ok, 'Admin AAL2 grava adesão pela API');
  const adhesion = workspaceAdhesionRecordSchema.parse(await response.json());
  check(
    adhesion.companyId === companyA &&
      adhesion.recordedBy === admin.id &&
      adhesion.evidenceReference === payload.evidenceReference,
    'contrato retornado e autoria de servidor',
  );
  check(
    !(await request(rpc, session.access_token, { ...payload, recordedBy: randomUUID() })).ok,
    'payload com autoria extra rejeitado',
  );
  const directWrite = await request('/rest/v1/workspace_adhesions', session.access_token, {
    company_id: companyA,
    evidence_reference: 'forjada',
    recorded_by: admin.id,
  });
  check(directWrite.status === 403, 'escrita direta negada mesmo ao Admin');
  const selected = await request(
    `/rest/v1/workspace_adhesions?id=eq.${adhesion.id}`,
    session.access_token,
  );
  check(
    selected.ok && z.array(z.object({ id: z.uuid() })).parse(await selected.json()).length === 1,
    'Admin lê o registro persistido',
  );
  for (const company of [companyA, companyB]) {
    const client = await actor('client', company);
    const list = await request('/rest/v1/workspace_adhesions', client.token);
    check(
      list.ok && z.array(z.object({})).parse(await list.json()).length === 0,
      'Cliente A/B sem projeção de evidência',
    );
    check(
      (await request(rpc, client.token, payload)).status === 403,
      'Cliente A/B não registra adesão',
    );
  }
  check([401, 403].includes((await request(rpc, keys.ANON_KEY, payload)).status), 'anônimo negado');
  check(
    (await request(rpc, keys.SERVICE_ROLE_KEY, payload)).status === 403,
    'service role não substitui autoria Admin',
  );
  const removed = await request(
    `/auth/v1/factors/${factor.id}`,
    session.access_token,
    undefined,
    'DELETE',
  );
  check(removed.ok, 'remoção do fator de teste');
  check(
    (await request(rpc, session.access_token, payload)).status === 403,
    'AAL2 antigo após remover fator negado',
  );
  localSql(`update cali_workspace.profiles set active = false where id = '${admin.id}';`);
  check(
    (await request(rpc, session.access_token, payload)).status === 403,
    'perfil inativo corta escrita com JWT válido',
  );
  check(
    localSql(
      `select count(*) from cali_workspace.workspace_adhesions where id = '${adhesion.id}';`,
    ) === '1',
    'negativas não criaram/alteraram o registro',
  );
  process.stdout.write(
    `Adesão API/Auth local: ${checks} verificações passaram. Atores/empresas/evidência sintéticos preservados no laboratório.\n`,
  );
}

void main().catch(() => {
  process.stderr.write(
    `Teste API local falhou na etapa: ${stage}. Nenhum segredo impresso; fixtures locais podem permanecer.\n`,
  );
  process.exitCode = 1;
});
