import { describe, expect, it } from 'vitest';
import { readEnvironment } from '../src/config/environment';

describe('configuração local', () => {
  it('assume somente demo quando nenhuma configuração é fornecida', () => {
    expect(readEnvironment({}).VITE_DATA_MODE).toBe('demo');
  });

  it.each([
    { VITE_DATA_MODE: 'production' },
    { VITE_DATA_MODE: 'supabase' },
    { VITE_DEMO_MODE: 'false' },
    { VITE_SUPABASE_URL: 'https://example.supabase.co' },
    { VITE_API_URL: 'https://api.example.test' },
  ])('recusa configuração que poderia habilitar integração: %j', (environment) => {
    expect(() => readEnvironment(environment)).toThrow('somente dados demonstrativos locais');
  });
});
