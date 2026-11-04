import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { createServer } from 'vite';
import { z } from 'zod';

const run = promisify(execFile);
const relayInput = z.object({
  path: z
    .string()
    .regex(
      /^\/(?:auth\/v1\/(?:user|token|logout)|rest\/v1\/(?:profiles|companies|terms_acceptances)|functions\/v1\/workspace-access)(?:\?[^#]*)?$/,
    ),
  token: z
    .string()
    .regex(/^[\w.-]+$/)
    .optional(),
  body: z.record(z.string(), z.json()).optional(),
});

type BrowserPorts = {
  cli: string;
  directory: string;
  email: string;
  forward: (input: z.infer<typeof relayInput>) => { status: number; bodyText: string };
  code: () => Promise<string>;
  revoke: () => void;
};

export async function verifyAccessInBrowser(ports: BrowserPorts) {
  const qaOrigin = 'https://isolated-cali-qa.supabase.co';
  const relay = `/__cali_qa_${randomUUID()}`;
  const session = `cali-qa-${randomUUID()}`;
  const vite = await createServer({
    envFile: false,
    define: {
      'import.meta.env.VITE_DATA_MODE': JSON.stringify('supabase'),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(qaOrigin),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_isolated_qa'),
    },
    server: { host: '127.0.0.1', port: 0, hmr: false },
  });
  vite.middlewares.stack.unshift({
    route: '',
    handle: async (request, response, next) => {
      const path = request.url ?? '';
      if (!path.startsWith(relay) || request.method !== 'POST') return next();
      try {
        if (path === `${relay}/code`) return void response.end(await ports.code());
        if (path === `${relay}/revoke`) {
          ports.revoke();
          return void response.end();
        }
        if (path !== relay) throw new Error('Rota de teste inválida.');
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of request) {
          const bytes = Buffer.from(chunk);
          size += bytes.length;
          if (size > 8192) throw new Error('Requisição de teste grande.');
          chunks.push(bytes);
        }
        const result = ports.forward(
          relayInput.parse(JSON.parse(Buffer.concat(chunks).toString())),
        );
        response.writeHead(result.status, { 'Content-Type': 'application/json' });
        response.end(result.bodyText);
      } catch {
        response.writeHead(502).end();
      }
    },
  });
  const browserCode = resolve(ports.directory, 'browser-check.js');
  async function cli(...args: string[]) {
    return run(process.execPath, [ports.cli, `-s=${session}`, ...args], { timeout: 200_000 });
  }
  try {
    await vite.listen();
    const origin = z.string().parse(vite.resolvedUrls?.local[0]).replace(/\/$/, '');
    if (!origin.startsWith('http://127.0.0.1:')) throw new Error('Vite de teste fora de loopback.');
    await writeFile(
      browserCode,
      `async (page) => {
      let stage = 'carregar SPA';
      const trace = [];
      try {
        const origin = ${JSON.stringify(origin)};
        const relay = origin + ${JSON.stringify(relay)};
        await page.route('**/*', async (route) => {
          const request = route.request();
          const url = new URL(request.url());
          if (url.origin === origin) return route.continue();
          if (url.origin !== ${JSON.stringify(qaOrigin)}) return route.abort();
          const token = request.headers().authorization?.replace(/^Bearer /, '');
          const body = request.postData() ? request.postDataJSON() : undefined;
          const result = await page.request.post(relay, { data: {
            path: url.pathname + url.search,
            token: token?.startsWith('sb_publishable_') ? undefined : token,
            body
          }});
          trace.push((body?.action ?? url.pathname) + ' ' + result.status());
          return route.fulfill({ response: result });
        });
        await page.goto(origin + '/cliente', { waitUntil: 'domcontentloaded' });
        stage = 'solicitar código pela SPA';
        await page.getByLabel('E-mail', {exact: true}).fill(${JSON.stringify(ports.email)});
        await page.getByRole('button', {name: 'Receber código'}).click();
        await page.getByLabel('Código de acesso').waitFor({timeout: 20000});
        const code = await page.request.post(relay + '/code');
        if (!code.ok()) throw new Error('Mailpit');
        stage = 'confirmar código e aceitar termos';
        await page.getByLabel('Código de acesso').fill(await code.text());
        await page.getByRole('button', {name: 'Confirmar código'}).click();
        await page.getByRole('checkbox', {name: /Li e aceito/}).check({timeout: 35000});
        await page.getByRole('button', {name: 'Aceitar e continuar'}).click();
        stage = 'abrir área autenticada';
        await page.waitForURL(url => ['/cliente', '/cliente/'].includes(url.pathname), {timeout: 60000});
        stage = 'consultar empresa vinculada';
        await page.getByRole('link', {name: 'Consultar minha empresa'}).click();
        await page.getByText('Empresa Auth QA', {exact: true}).first().waitFor({timeout: 15000});
        stage = 'recusar sessão antiga após revogação';
        if (!(await page.request.post(relay + '/revoke')).ok()) throw new Error('RPC');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByText(/Seu acesso está indisponível/).waitFor({timeout: 35000});
        return 'CALI_BROWSER_OK';
      } catch {
        return 'CALI_BROWSER_FAILURE: ' + stage + ' [' + trace.slice(-12).join(', ') + ']';
      }
    }`,
    );
    await cli('open', 'about:blank', '--browser=chrome');
    const result = await cli('run-code', '--filename', browserCode).catch((error) => {
      const report = z.object({ stdout: z.string(), stderr: z.string() }).safeParse(error);
      const detail = report.success
        ? [report.data.stdout, report.data.stderr]
            .join('\n')
            .match(/(?:### Error\s*\n|Error: )([^\r\n]+)/)?.[1]
        : undefined;
      throw new Error(
        detail
          ? `Playwright CLI: ${detail.slice(0, 180)}`
          : 'Playwright CLI não executou o cenário.',
        { cause: error },
      );
    });
    const { stdout } = result;
    if (!/^"CALI_BROWSER_OK"\r?$/m.test(stdout)) {
      const failed = stdout.match(/^"(CALI_BROWSER_FAILURE: [^"\r\n]+)"\r?$/m)?.[1];
      throw new Error(failed ?? 'Navegador não confirmou o cenário.');
    }
  } finally {
    await cli('close').catch(() => {});
    await vite.close();
  }
}
