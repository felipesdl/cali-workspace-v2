import { describe, expect, it } from 'vitest';
import { readEnvironment, resolveCaliRuntime } from '../src/config/environment';
const hosted = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
};
describe('configuração explícita de dados', () => {
  it('preserva demonstração sem credenciais e detecta o hospedado configurado', () => {
    expect(readEnvironment({}).mode).toBe('demo');
    expect(readEnvironment(hosted).mode).toBe('supabase');
  });
  it.each([
    { VITE_DATA_MODE: 'production' },
    { VITE_DATA_MODE: 'supabase' },
    { VITE_DEMO_MODE: 'false' },
    { VITE_SUPABASE_URL: hosted.VITE_SUPABASE_URL },
    { VITE_API_URL: 'https://api.example.test' },
    { ...hosted, VITE_DATA_MODE: 'demo' },
    { ...hosted, VITE_DEMO_MODE: 'true' },
    { ...hosted, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_forbidden' },
    { ...hosted, VITE_SUPABASE_URL: 'http://example.supabase.co' },
    { ...hosted, VITE_SUPABASE_URL: 'https://example.supabase.co.evil.test' },
    { ...hosted, VITE_SUPABASE_URL: 'https://example.supabase.co/?secret=x' },
  ])('recusa configuração incompleta, ambígua ou privilegiada: %j', (value) => {
    expect(() => readEnvironment(value)).toThrow('Configuração de ambiente inválida');
  });
});

describe('núcleo publicado do CALI MAPA', () => {
  const caliMap = { ...hosted, VITE_SUPABASE_URL: 'https://kqtbfeeqbcllwvlkbrkq.supabase.co' };
  const origin = 'https://app.calirh.com';

  it('exige ativação explícita e não liga o piloto no build publicado', () => {
    expect(resolveCaliRuntime(readEnvironment(caliMap), false, origin)).toEqual({
      pilot: false,
      preview: false,
      releaseCore: false,
    });
    const environment = readEnvironment({ ...caliMap, VITE_CALI_RELEASE_CORE: 'true' });
    expect(resolveCaliRuntime(environment, false, origin)).toEqual({
      pilot: false,
      preview: false,
      releaseCore: true,
    });
    expect(resolveCaliRuntime(environment, true, 'http://127.0.0.1:5173')).toEqual({
      pilot: true,
      preview: false,
      releaseCore: false,
    });
    expect(resolveCaliRuntime(environment, false, 'https://preview.example.com')).toEqual({
      pilot: false,
      preview: false,
      releaseCore: false,
    });
  });

  it('recusa ativação com fixtures ou outro projeto Supabase', () => {
    expect(() => readEnvironment({ VITE_CALI_RELEASE_CORE: 'true' })).toThrow(
      'Configuração de ambiente inválida',
    );
    expect(() => readEnvironment({ ...hosted, VITE_CALI_RELEASE_CORE: 'true' })).toThrow(
      'Configuração de ambiente inválida',
    );
  });
});

describe('preview isolado no Vercel', () => {
  const origin = 'https://cali-qa.vercel.app';

  it.each([origin, 'https://staging.calirh.com'])(
    'habilita o preview apenas na origem %s',
    (selected) => {
      const environment = readEnvironment({ ...hosted, VITE_CALI_PREVIEW_ORIGIN: selected });
      expect(resolveCaliRuntime(environment, false, selected)).toEqual({
        pilot: false,
        preview: true,
        releaseCore: false,
      });
      expect(resolveCaliRuntime(environment, true, selected).preview).toBe(false);
      expect(resolveCaliRuntime(environment, false, 'https://cali-other.vercel.app').preview).toBe(
        false,
      );
      expect(resolveCaliRuntime(environment, false, 'https://app.calirh.com').preview).toBe(false);
    },
  );

  it.each([
    { VITE_CALI_PREVIEW_ORIGIN: origin },
    { ...hosted, VITE_CALI_PREVIEW_ORIGIN: `${origin}/` },
    { ...hosted, VITE_CALI_PREVIEW_ORIGIN: 'http://cali-qa.vercel.app' },
    { ...hosted, VITE_CALI_PREVIEW_ORIGIN: 'https://cali-qa.vercel.app.example.test' },
    { ...hosted, VITE_CALI_PREVIEW_ORIGIN: 'https://app.calirh.com' },
    { ...hosted, VITE_CALI_PREVIEW_ORIGIN: 'https://staging.calirh.com.example.test' },
    { ...hosted, VITE_CALI_PREVIEW_ORIGIN: origin, VITE_CALI_RELEASE_CORE: 'true' },
    {
      ...hosted,
      VITE_CALI_PREVIEW_ORIGIN: origin,
      VITE_SUPABASE_URL: 'https://kqtbfeeqbcllwvlkbrkq.supabase.co',
    },
  ])('recusa preview fora do contrato: %j', (value) => {
    expect(() => readEnvironment(value)).toThrow('Configuração de ambiente inválida');
  });
});
