// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  assertLocalIngressFiles,
  validateLocalContainer,
  type LocalContainerTopology,
} from '../scripts/local-database.ts';

const topology = (): LocalContainerTopology => ({
  running: true,
  labels: { 'com.supabase.cli.project': 'cali-workspace-v2-local' },
  networks: { 'cali-workspace-v2-isolated': {} },
  ports: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '56322' }] },
});

const invalidTopologies: Partial<LocalContainerTopology>[] = [
  { running: false },
  { labels: { 'com.supabase.cli.project': 'outro-projeto' } },
  { networks: { 'cali-workspace-v2-isolated': {}, bridge: {} } },
  { networks: { bridge: {} } },
  { ports: { '5432/tcp': [{ HostIp: '0.0.0.0', HostPort: '56322' }] } },
  { ports: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '5432' }] } },
];

describe('alvo do runner de banco local', () => {
  it('aceita somente o projeto/rede/loopback dedicados', () => {
    expect(() => validateLocalContainer(topology())).not.toThrow();
    expect(assertLocalIngressFiles).not.toThrow();
  });
  it.each(invalidTopologies)('recusa alvo/topologia divergentes: %j', (change) => {
    expect(() => validateLocalContainer({ ...topology(), ...change })).toThrow();
  });
});
