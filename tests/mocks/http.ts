import { type AxiosAdapter } from 'axios';

// Respostas controladas de sucesso/contrato inválido, exclusivas dos testes.
// eslint-disable-next-line no-restricted-syntax -- Entrada deliberadamente inválida para testar rejeição pelos schemas.
export function createStaticResponseAdapter(data: unknown): AxiosAdapter {
  return async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: structuredClone(data),
  });
}
