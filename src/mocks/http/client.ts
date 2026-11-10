import axios, { type AxiosAdapter } from 'axios';

const MOCK_BASE_URL = '/__cali_mock__';

// O adapter local é obrigatório. Esta fábrica não oferece transporte de rede.
export function createMockHttpClient(adapter: AxiosAdapter) {
  const client = axios.create({
    baseURL: MOCK_BASE_URL,
    adapter,
    timeout: 10_000,
    withCredentials: false,
  });

  client.interceptors.request.use((config) => {
    const url = config.url ?? '';
    if (
      config.baseURL !== MOCK_BASE_URL ||
      config.adapter !== adapter ||
      !url.startsWith('/') ||
      url.startsWith('//') ||
      url.includes('..') ||
      url.includes('://')
    ) {
      throw new Error('Destino não permitido no modo demonstrativo local.');
    }
    return config;
  });

  return client;
}
