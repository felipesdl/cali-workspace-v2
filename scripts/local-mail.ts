import { createConnection } from 'node:net';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { assertLocalDatabase } from './local-database.ts';

async function main() {
  assertLocalDatabase();
  const subject = `CALI-local-${randomUUID()}`;
  const socket = createConnection({ host: '127.0.0.1', port: 56325 });
  function reply(command?: string) {
    return new Promise<number>((done, fail) => {
      let buffer = '';
      const cleanup = () => {
        socket.off('data', data);
        socket.off('error', error);
        socket.off('timeout', timeout);
        socket.setTimeout(0);
      };
      const error = () => {
        cleanup();
        fail(new Error('Falha SMTP local.'));
      };
      const timeout = () => {
        cleanup();
        fail(new Error('Timeout SMTP local.'));
      };
      const data = (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        const code = buffer.match(/(?:^|\r\n)(\d{3}) [^\r\n]*\r\n$/);
        if (code) {
          cleanup();
          done(Number(code[1]));
        }
      };
      socket.on('data', data);
      socket.once('error', error);
      socket.once('timeout', timeout);
      socket.setTimeout(5000);
      if (command) socket.write(`${command}\r\n`);
    });
  }
  try {
    const commands = [
      { expected: 220, command: undefined },
      { expected: 250, command: 'EHLO cali-local' },
      { expected: 250, command: 'MAIL FROM:<sender@example.test>' },
      { expected: 250, command: 'RCPT TO:<recipient@example.test>' },
      { expected: 354, command: 'DATA' },
      {
        expected: 250,
        command: `From: sender@example.test\r\nTo: recipient@example.test\r\nSubject: ${subject}\r\n\r\nMensagem sintetica de captura local.\r\n.`,
      },
      { expected: 221, command: 'QUIT' },
    ];
    for (const { expected, command } of commands) {
      if ((await reply(command)) !== expected) throw new Error('Resposta SMTP inesperada.');
    }
    const response = await fetch('http://127.0.0.1:56324/api/v1/messages', {
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    const messages = z
      .object({ messages: z.array(z.object({ Subject: z.string() })) })
      .parse(await response.json());
    if (!response.ok || !messages.messages.some((message) => message.Subject === subject))
      throw new Error('Mensagem não localizada na captura local.');
    process.stdout.write(
      'SMTP local: mensagem sintética capturada e conferida no Mailpit; nenhum envio externo configurado.\n',
    );
  } finally {
    socket.destroy();
  }
}

void main().catch(() => {
  process.stderr.write('Prova de captura local falhou; não declarar entrega comprovada.\n');
  process.exitCode = 1;
});
