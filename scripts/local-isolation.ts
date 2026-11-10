import { execFileSync } from 'node:child_process';
import { createConnection, createServer } from 'node:net';
import { assertLocalDatabase } from './local-database.ts';

// Provas específicas, sem sondar serviços de outros projetos.
function connectsFrom(container: string, image: string, host: string, port: number) {
  try {
    execFileSync(
      'docker',
      [
        'run',
        '--rm',
        '--cap-drop',
        'ALL',
        '--security-opt',
        'no-new-privileges:true',
        '--network',
        `container:${container}`,
        '--entrypoint',
        'bash',
        image,
        '-c',
        `timeout 2 bash -c 'exec 3<>/dev/tcp/${host}/${port}'`,
      ],
      { stdio: 'pipe', timeout: 10_000 },
    );
    return true;
  } catch (error) {
    if (error instanceof Error && 'status' in error && [1, 124, 143].includes(Number(error.status)))
      return false;
    // Erro de ferramenta não comprova bloqueio; preservar a causa para o chamador.
    throw error;
  }
}

async function main() {
  const names = assertLocalDatabase();
  const canary = createServer((socket) => socket.end());
  await new Promise<void>((done, fail) => {
    canary.once('error', fail);
    canary.listen(56320, '127.0.0.1', done);
  });
  try {
    await new Promise<void>((done, fail) => {
      const connection = createConnection({ host: '127.0.0.1', port: 56320 });
      connection.once('error', fail);
      connection.once('connect', () => {
        connection.destroy();
        done();
      });
    });
    const image = execFileSync(
      'docker',
      ['inspect', 'supabase_db_cali-workspace-v2-local', '--format', '{{.Image}}'],
      { encoding: 'utf8' },
    ).trim();
    for (const name of names) {
      if (!connectsFrom(name, image, 'supabase_db_cali-workspace-v2-local', 5432))
        throw new Error('Controle interno falhou.');
      if (connectsFrom(name, image, '1.1.1.1', 443))
        throw new Error('Egress externo indevidamente disponível.');
      if (connectsFrom(name, image, 'host.docker.internal', 56320))
        throw new Error('Canário do host indevidamente alcançável.');
      process.stdout.write(`${name}: interno OK; IP externo e canário do host bloqueados.\n`);
    }
  } finally {
    await new Promise<void>((done) => canary.close(() => done()));
  }
}

void main().catch(() => {
  process.stderr.write('Prova de isolamento falhou/não executou; não integrar dados.\n');
  process.exitCode = 1;
});
