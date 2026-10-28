// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildLocalConfig, validateLocalConfiguration } from '../scripts/local-environment.ts';

const input = (): Parameters<typeof validateLocalConfiguration>[0] => ({
  configText: readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8'),
  linked: false,
  environment: {},
  environmentFiles: [],
});

describe('pré-condições do ambiente local isolado', () => {
  it('aceita a configuração versionada sem vínculo, credenciais ou arquivos não revisados', () => {
    expect(validateLocalConfiguration(input())).toEqual([]);
  });

  it.each([
    [
      'migrations automáticas',
      '[db.migrations]\nenabled = false',
      '[db.migrations]\nenabled = true',
    ],
    ['SMTP externo', '[auth.email.smtp]\nenabled = false', '[auth.email.smtp]\nenabled = true'],
    [
      'callback remoto',
      'http://127.0.0.1:5173/auth/callback',
      'https://example.invalid/auth/callback',
    ],
  ])('recusa mudança não revisada: %s', (_name, before, after) => {
    expect(
      validateLocalConfiguration({
        ...input(),
        configText: buildLocalConfig().replace(before, after),
      }),
    ).toContain('Configuração local diverge da definição revisada; não iniciar serviços.');
  });

  it('recusa vínculo remoto, mesmo quando o arquivo é ignorado pelo Git', () => {
    expect(validateLocalConfiguration({ ...input(), linked: true }).join(' ')).toContain(
      'vínculo remoto não permitido',
    );
  });

  it('bloqueia overrides e informa somente o nome, sem vazar seu valor', () => {
    for (const name of [
      'SUPABASE_ACCESS_TOKEN',
      'SUPABASE_AUTH_EXTERNAL_GOOGLE_ENABLED',
      'PGHOST',
      'PGPASSWORD',
      'DATABASE_URL',
      'DOCKER_HOST',
    ]) {
      const result = validateLocalConfiguration({
        ...input(),
        environment: { [name]: 'valor-sintetico-privado' },
      }).join(' ');
      expect(result).toContain(name);
      expect(result).not.toContain('valor-sintetico-privado');
    }
  });

  it('recusa arquivo de ambiente não conferido antes de chamar ferramentas', () => {
    expect(
      validateLocalConfiguration({ ...input(), environmentFiles: ['supabase/.env'] }).join(' '),
    ).toContain('Arquivos de ambiente não revisados: supabase/.env.');
  });
});
