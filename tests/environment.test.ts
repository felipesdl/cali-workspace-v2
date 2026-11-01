import { describe, expect, it } from 'vitest';
import { readEnvironment } from '../src/config/environment';
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
