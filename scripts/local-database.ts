import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';
import { localEnvironment, validateLocalConfiguration } from './local-environment.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrations = [
  {
    version: '20261029090000',
    file: 'supabase/migrations/20261029090000_access_adhesion_baseline.sql',
  },
  { version: '20261029120000', file: 'supabase/migrations/20261029120000_codes_terms.sql' },
  { version: '20261029123000', file: 'supabase/migrations/20261029123000_access_revocation.sql' },
] as const;
const databaseContainer = `supabase_db_${localEnvironment.projectId}`;
const ingressName = 'cali-workspace-v2-ingress';
const ingressImage =
  'haproxy:3.3-alpine@sha256:75adccfd45f1bb9eaba777b80f93a249e66a8309d6d4f0c65410b683a3906728';
const reviewedIngressFiles = {
  'supabase/local/haproxy.cfg': 'e294163c15c8a7f0431e5dd31ae7bc49e606f80c8f2502ab8fe8608c08aed89e',
  'supabase/local/compose.yaml': '737cf9f2d3e153f599153ae1412ad60da5cd7b4cd737f354c751e46fe058f111',
};

export function assertLocalIngressFiles() {
  for (const [file, expected] of Object.entries(reviewedIngressFiles)) {
    if (
      createHash('sha256')
        .update(readFileSync(resolve(root, file)))
        .digest('hex') !== expected
    ) {
      throw new Error(
        'Configuração do proxy diverge da revisão; conferir destinos/restrições antes de executar.',
      );
    }
  }
}

const topologySchema = z.object({
  running: z.boolean(),
  labels: z.record(z.string(), z.string()),
  networks: z.record(z.string(), z.object({})),
  ports: z.record(
    z.string(),
    z.array(z.object({ HostIp: z.string(), HostPort: z.string() })).nullable(),
  ),
});
export type LocalContainerTopology = z.infer<typeof topologySchema>;

const ingressSchema = topologySchema.extend({
  image: z.literal(ingressImage),
  readonly: z.literal(true),
  caps: z.array(z.string()),
  security: z.array(z.string()),
  sysctls: z.record(z.string(), z.string()),
  mounts: z.array(z.object({ Source: z.string(), Destination: z.string(), RW: z.boolean() })),
});

function assertLocalIngress() {
  const format =
    '{"running":{{json .State.Running}},"labels":{{json .Config.Labels}},"networks":{{json .NetworkSettings.Networks}},"ports":{{json .NetworkSettings.Ports}},"image":{{json .Config.Image}},"readonly":{{json .HostConfig.ReadonlyRootfs}},"caps":{{json .HostConfig.CapDrop}},"security":{{json .HostConfig.SecurityOpt}},"sysctls":{{json .HostConfig.Sysctls}},"mounts":{{json .Mounts}}}';
  const proxy = ingressSchema.parse(
    JSON.parse(run('docker', ['inspect', ingressName, '--format', format])),
  );
  if (
    !proxy.running ||
    proxy.labels['com.cali.local.project'] !== localEnvironment.projectId ||
    Object.keys(proxy.networks).sort().join(',') !==
      [localEnvironment.network, ingressName].sort().join(',') ||
    !proxy.caps.includes('ALL') ||
    !proxy.security.some((value) => value.startsWith('no-new-privileges')) ||
    proxy.sysctls['net.ipv4.ip_forward'] !== '0' ||
    proxy.sysctls['net.ipv6.conf.all.forwarding'] !== '0'
  ) {
    throw new Error('Proxy local diverge das restrições revisadas.');
  }
  const expectedPorts = [56321, 56322, 56324, 56325];
  if (
    Object.keys(proxy.ports).length !== expectedPorts.length ||
    expectedPorts.some((port) => {
      const bindings = proxy.ports[`${port}/tcp`];
      return (
        bindings?.length !== 1 ||
        bindings[0].HostIp !== '127.0.0.1' ||
        bindings[0].HostPort !== String(port)
      );
    })
  )
    throw new Error('Proxy não comprova os quatro bindings de loopback.');
  if (
    proxy.mounts.length !== 1 ||
    proxy.mounts[0].RW ||
    proxy.mounts[0].Source !== resolve(root, 'supabase/local/haproxy.cfg') ||
    proxy.mounts[0].Destination !== '/usr/local/etc/haproxy/haproxy.cfg'
  ) {
    throw new Error('Mount do proxy não corresponde à configuração local revisada.');
  }
  const ingressNetwork = z.object({ Internal: z.literal(false), Driver: z.literal('bridge') });
  ingressNetwork.parse(
    JSON.parse(run('docker', ['network', 'inspect', ingressName, '--format', '{{json .}}'])),
  );
}

export function validateLocalContainer(topology: LocalContainerTopology) {
  if (!topology.running) throw new Error('Container CALI não está em execução.');
  if (topology.labels['com.supabase.cli.project'] !== localEnvironment.projectId) {
    throw new Error('Container não pertence ao projeto CALI local.');
  }
  const networks = Object.keys(topology.networks);
  if (networks.length !== 1 || networks[0] !== localEnvironment.network) {
    throw new Error('Container deve usar somente a rede CALI isolada.');
  }
  for (const bindings of Object.values(topology.ports)) {
    for (const binding of bindings ?? []) {
      if (
        binding.HostIp !== localEnvironment.host ||
        !Object.values(localEnvironment.ports).some((port) => String(port) === binding.HostPort)
      ) {
        throw new Error('Binding fora do loopback/portas CALI revisados.');
      }
    }
  }
}

function run(tool: string, args: string[], input?: string) {
  return execFileSync(tool, args, {
    cwd: root,
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 30_000,
  }).trim();
}

export function assertLocalDatabase() {
  assertLocalIngressFiles();
  const files = ['', 'supabase'].flatMap((directory) =>
    readdirSync(resolve(root, directory))
      .filter((name) => (name === '.env' || name.startsWith('.env.')) && !name.endsWith('.example'))
      .map((name) => `${directory}/${name}`),
  );
  const errors = validateLocalConfiguration({
    configText: readFileSync(resolve(root, 'supabase/config.toml'), 'utf8'),
    linked: existsSync(resolve(root, 'supabase/.temp/project-ref')),
    environment: process.env,
    environmentFiles: files,
  });
  if (errors.length) throw new Error(errors.join('\n'));
  if (
    !run('docker', ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}']).startsWith(
      'unix://',
    )
  ) {
    throw new Error('Docker remoto não permitido.');
  }
  if (run('supabase', ['--version']) !== localEnvironment.cliVersion) {
    throw new Error('CLI local diverge da versão revisada.');
  }
  const network = z.object({
    Internal: z.literal(true),
    Driver: z.literal('bridge'),
    Options: z.object({ 'com.docker.network.bridge.host_binding_ipv4': z.literal('127.0.0.1') }),
  });
  network.parse(
    JSON.parse(
      run('docker', ['network', 'inspect', localEnvironment.network, '--format', '{{json .}}']),
    ),
  );
  assertLocalIngress();
  const names = run('docker', [
    'ps',
    '-a',
    '--filter',
    `label=com.supabase.cli.project=${localEnvironment.projectId}`,
    '--format',
    '{{.Names}}',
  ])
    .split('\n')
    .filter(Boolean);
  if (!names.includes(databaseContainer)) throw new Error('Postgres CALI local ausente.');
  for (const name of names) {
    const format =
      '{"running":{{json .State.Running}},"labels":{{json .Config.Labels}},"networks":{{json .NetworkSettings.Networks}},"ports":{{json .NetworkSettings.Ports}}}';
    validateLocalContainer(
      topologySchema.parse(JSON.parse(run('docker', ['inspect', name, '--format', format]))),
    );
  }
  return names;
}

export function localSql(sql: string) {
  return run(
    'docker',
    [
      'exec',
      '-i',
      databaseContainer,
      'psql',
      '-X',
      '-qAt',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      'postgres',
    ],
    sql,
  );
}

function applyBaseline() {
  for (const migration of migrations) {
    const sql = readFileSync(resolve(root, migration.file), 'utf8');
    const digest = createHash('sha256').update(sql).digest('hex');
    const installed = localSql(
      "select to_regclass('cali_private.baseline_revisions') is not null;",
    );
    if (installed === 't') {
      const previous = localSql(
        `select digest from cali_private.baseline_revisions where version = '${migration.version}';`,
      );
      if (previous) {
        if (previous !== digest)
          throw new Error('Migration aplicada diverge do arquivo; não reaplicar/resetar.');
        process.stdout.write(`Migration ${migration.version}: digest confere; sem escrita.\n`);
        continue;
      }
    } else if (
      migration !== migrations[0] ||
      localSql("select to_regnamespace('cali_workspace') is not null;") === 't'
    ) {
      throw new Error('Schema sem journal/ordem de baseline inválida; não sobrescrever.');
    }
    localSql(
      `begin; select pg_advisory_xact_lock(29090000);\n${sql}\ninsert into cali_private.baseline_revisions(version, digest) values ('${migration.version}', '${digest}');\nnotify pgrst, 'reload schema'; commit;`,
    );
    process.stdout.write(`Migration ${migration.version}: aplicada em transação local.\n`);
  }
}

function main() {
  const command = process.argv[2];
  if (!['--inspect', '--apply', '--test'].includes(command))
    throw new Error('Use --inspect, --apply ou --test.');
  const names = assertLocalDatabase();
  if (command === '--apply') applyBaseline();
  if (command === '--test') {
    for (const file of ['supabase/tests/adhesion.sql', 'supabase/tests/access.sql']) {
      process.stdout.write(`${localSql(readFileSync(resolve(root, file), 'utf8'))}\n`);
    }
  }
  if (command === '--inspect')
    process.stdout.write(
      `Topologia CALI conferida: ${names.length} serviços de negócio somente na rede internal; proxy fixo em loopback. Egress exige prova separada.\n`,
    );
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    main();
  } catch {
    process.stderr.write(
      'Operação local recusada/falhou; nenhum fallback remoto. Conferir precondições/topologia e erro em execução controlada.\n',
    );
    process.exitCode = 1;
  }
}
