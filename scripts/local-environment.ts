import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createConnection } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';

export const localEnvironment = {
  projectId: 'cali-workspace-v2-local',
  network: 'cali-workspace-v2-isolated',
  cliVersion: '2.122.0',
  host: '127.0.0.1',
  ports: { shadow: 56320, api: 56321, database: 56322, studio: 56323, mail: 56324, smtp: 56325 },
} as const;

// Esta configuração prepara o ambiente; não cria schema, aplica SQL ou inicia serviços.
export function buildLocalConfig() {
  const { projectId, ports } = localEnvironment;
  return `# Gerado por scripts/local-environment.ts; não contém credenciais.
project_id = "${projectId}"

[api]
enabled = true
port = ${ports.api}
schemas = ["cali_workspace"]
extra_search_path = ["cali_workspace", "extensions"]

[db]
port = ${ports.database}
shadow_port = ${ports.shadow}
major_version = 17

[db.migrations]
enabled = false
schema_paths = []

[db.seed]
enabled = false
sql_paths = []

[db.pooler]
enabled = false

[realtime]
enabled = false

[studio]
enabled = false
port = ${ports.studio}

[local_smtp]
enabled = true
port = ${ports.mail}
smtp_port = ${ports.smtp}

[storage]
enabled = false

[storage.s3_protocol]
enabled = false

[storage.vector]
enabled = false

[auth]
enabled = true
site_url = "http://127.0.0.1:5173"
additional_redirect_urls = ["http://127.0.0.1:5173/auth/callback"]
enable_signup = false
enable_anonymous_sign_ins = false

[auth.email]
enable_signup = true
otp_length = 6
otp_expiry = 600
max_frequency = "120s"

[auth.email.smtp]
enabled = false

[auth.mfa.totp]
enroll_enabled = true
verify_enabled = true

[auth.mfa.phone]
enroll_enabled = false
verify_enabled = false

[edge_runtime]
enabled = true
policy = "per_worker"

[functions.workspace-access]
verify_jwt = false
entrypoint = "./.temp/workspace-access/index.ts"

[analytics]
enabled = false
`;
}

type ConfigurationInput = {
  configText: string;
  linked: boolean;
  environment: NodeJS.ProcessEnv;
  environmentFiles: string[];
};

export function validateLocalConfiguration(input: ConfigurationInput) {
  const errors: string[] = [];
  if (input.configText.replace(/\r\n/g, '\n') !== buildLocalConfig()) {
    errors.push('Configuração local diverge da definição revisada; não iniciar serviços.');
  }
  if (input.linked)
    errors.push('supabase/.temp/project-ref presente; vínculo remoto não permitido.');
  const overrides = Object.keys(input.environment).filter((name) =>
    /^(SUPABASE_|PG[A-Z_]|DATABASE_URL$|POSTGRES_URL$|DOCKER_HOST$|DOCKER_CONTEXT$|DOCKER_TLS_VERIFY$|DOCKER_CERT_PATH$)/.test(
      name,
    ),
  );
  if (overrides.length)
    errors.push(`Overrides de ambiente não permitidos: ${overrides.join(', ')}.`);
  if (input.environmentFiles.length) {
    errors.push(`Arquivos de ambiente não revisados: ${input.environmentFiles.join(', ')}.`);
  }
  return errors;
}

function portAvailability(port: number): Promise<string | null> {
  return new Promise((finish) => {
    const socket = createConnection({ host: localEnvironment.host, port });
    const done = (message: string | null) => {
      socket.destroy();
      finish(message);
    };
    socket.once('connect', () => done(`Porta ${port} já ocupada; não reutilizar outro serviço.`));
    socket.once('error', (error) => {
      done(
        'code' in error && error.code === 'ECONNREFUSED'
          ? null
          : `Porta ${port} não pôde ser verificada.`,
      );
    });
    socket.setTimeout(1000, () => done(`Timeout ao verificar a porta ${port}.`));
  });
}

const networkSchema = z.object({
  Internal: z.boolean(),
  Driver: z.string(),
  Options: z.record(z.string(), z.string()).nullable(),
});

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const command = process.argv[2];
  if (command === '--print-config') {
    process.stdout.write(buildLocalConfig());
    return;
  }
  if (command !== '--check-config' && command !== '--preflight') {
    throw new Error('Use --check-config, --preflight ou --print-config.');
  }
  const configText = readFileSync(resolve(root, 'supabase/config.toml'), 'utf8');
  const errors = validateLocalConfiguration({
    configText,
    linked: false,
    environment: {},
    environmentFiles: [],
  });
  if (errors.length) throw new Error(errors.join('\n'));
  if (command === '--check-config') {
    process.stdout.write('Configuração local revisada: íntegra.\n');
    return;
  }

  const envFiles = ['', 'supabase'].flatMap((directory) =>
    readdirSync(resolve(root, directory))
      .filter((name) => (name === '.env' || name.startsWith('.env.')) && !name.endsWith('.example'))
      .map((name) => (directory ? `${directory}/${name}` : name)),
  );
  errors.push(
    ...validateLocalConfiguration({
      configText,
      linked: existsSync(resolve(root, 'supabase/.temp/project-ref')),
      environment: process.env,
      environmentFiles: envFiles,
    }),
  );
  // Falha antes de executar qualquer ferramenta se houver vínculo/override não revisado.
  if (errors.length) throw new Error(errors.join('\n'));
  const read = (tool: string, args: string[]) =>
    execFileSync(tool, args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10_000,
    }).trim();
  try {
    if (
      !read('docker', ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}']).startsWith(
        'unix://',
      )
    ) {
      throw new Error('Contexto Docker remoto não permitido.');
    }
    read('docker', ['version', '--format', '{{.Server.Version}}']);
  } catch {
    errors.push('Docker local indisponível ou sem permissão de leitura.');
  }
  try {
    if (read('supabase', ['--version']) !== localEnvironment.cliVersion) {
      errors.push(`CLI deve ser exatamente ${localEnvironment.cliVersion}.`);
    }
  } catch {
    errors.push(`CLI Supabase ${localEnvironment.cliVersion} não instalado/verificável no PATH.`);
  }
  try {
    const network = networkSchema.parse(
      JSON.parse(
        read('docker', ['network', 'inspect', localEnvironment.network, '--format', '{{json .}}']),
      ),
    );
    if (
      !network.Internal ||
      network.Driver !== 'bridge' ||
      network.Options?.['com.docker.network.bridge.host_binding_ipv4'] !== localEnvironment.host
    ) {
      errors.push('Rede dedicada não comprova isolamento interno e bind de loopback.');
    }
  } catch {
    errors.push('Rede dedicada ainda não existe ou não pôde ser inspecionada.');
  }
  errors.push(
    ...(await Promise.all(Object.values(localEnvironment.ports).map(portAvailability))).filter(
      (message) => message !== null,
    ),
  );
  if (errors.length) throw new Error(errors.join('\n'));
  process.stdout.write(
    'Pré-requisitos locais conferidos; stack, baseline, egress e RLS ainda exigem prova de execução.\n',
  );
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  void main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Falha no preflight local.'}\n`,
    );
    process.exitCode = 1;
  });
}
