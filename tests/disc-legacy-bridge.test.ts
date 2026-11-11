// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
const storageDownload = vi.hoisted(() => vi.fn());
const storageFrom = vi.hoisted(() => vi.fn(() => ({ download: storageDownload })));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc, storage: { from: storageFrom } }),
}));

import { createHostedDisc } from '../src/api/shared/disc/service';
import { createWorkspaceClient } from '../src/api/supabase';

const token = '30000000-0000-4000-8000-000000000003';
const projection = {
  state: 'opened',
  title: 'Questionário sintético',
  organization: null,
  person_name: 'Pessoa Sintética',
  deadline_at: '2026-11-18T23:59:00-03:00',
  last_block: 2,
};

beforeEach(() => {
  rpc.mockReset();
  storageDownload.mockReset();
  storageFrom.mockClear();
});

test('resolve convite legado pelo slug e token, com projeção reduzida', async () => {
  rpc.mockReturnValue({ abortSignal: async () => ({ data: projection, error: null }) });
  const service = createHostedDisc(createWorkspaceClient('https://example.test', 'public-key'));

  await expect(
    service.readLegacyPublic('ciclo-teste', token, new AbortController().signal),
  ).resolves.toEqual(projection);
  expect(rpc).toHaveBeenCalledWith('v2_disc_legacy_public', {
    p_slug: 'ciclo-teste',
    p_token: token,
    p_kind: 'read',
    p_fields: {},
  });
});

test('submete com requestId e não usa leitor público de resultado', async () => {
  rpc.mockResolvedValue({ data: { ...projection, state: 'completed' }, error: null });
  const service = createHostedDisc(createWorkspaceClient('https://example.test', 'public-key'));
  const fields = {
    requestId: '40000000-0000-4000-8000-000000000004',
    jobTitle: 'Analista',
    consent: true as const,
    answers: {
      natural: Array.from({ length: 18 }, (_, index) => ({
        b: index + 1,
        mais: 'D' as const,
        menos: 'I' as const,
      })),
      pressure: [2, 5, 8, 11, 14, 17].map((b) => ({ b, mais: 'S' as const, menos: 'C' as const })),
    },
  };

  await service.legacyPublicCommand('ciclo-teste', token, { kind: 'submit', fields });

  expect(rpc).toHaveBeenCalledWith('v2_disc_legacy_public', {
    p_slug: 'ciclo-teste',
    p_token: token,
    p_kind: 'submit',
    p_fields: fields,
  });
  expect(rpc).not.toHaveBeenCalledWith('cali_profile_result');
});

test('rejeita cargo acima do limite V1/V2 antes da RPC', async () => {
  const service = createHostedDisc(createWorkspaceClient('https://example.test', 'public-key'));

  await expect(
    service.legacyPublicCommand('ciclo-teste', token, {
      kind: 'submit',
      fields: {
        requestId: '40000000-0000-4000-8000-000000000004',
        jobTitle: 'x'.repeat(121),
        consent: true,
        answers: {
          natural: Array.from({ length: 18 }, (_, index) => ({
            b: index + 1,
            mais: 'D',
            menos: 'I',
          })),
          pressure: [2, 5, 8, 11, 14, 17].map((b) => ({ b, mais: 'S', menos: 'C' })),
        },
      },
    }),
  ).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
});

test('lê catálogo legado pelo RPC Admin protegido, sem caminho público', async () => {
  const link = {
    id: '10000000-0000-4000-8000-000000000001',
    slug: 'ciclo-teste',
    title: 'Questionário sintético',
    purpose: 'desenvolvimento',
    status: 'open',
    created_at: '2026-11-10T12:00:00Z',
    company_id: '9c5ab148-78b8-4410-9338-58c44222a5db',
    company_name: 'Empresa sintética A',
    invite_count: 1,
    result_count: 0,
    management: {
      goal: null,
      note: null,
      moment: null,
      sector: null,
      approved_at: null,
      released_at: null,
      protocol: null,
    },
  };
  const snapshot = { links: [link], selected: null };
  rpc.mockReturnValue({ abortSignal: async () => ({ data: snapshot, error: null }) });
  const service = createHostedDisc(createWorkspaceClient('https://example.test', 'public-key'));

  await expect(service.legacyAdminSnapshot(null, new AbortController().signal)).resolves.toEqual(
    snapshot,
  );
  expect(rpc).toHaveBeenCalledWith('v2_disc_legacy_admin', { p_link: null });
  expect(rpc).not.toHaveBeenCalledWith('cali_profile_report', expect.anything());
});

test('baixa PDF histórico pelo bucket privado com path validado', async () => {
  const pdf = new Blob(['fixture pdf'], { type: 'application/pdf' });
  storageDownload.mockResolvedValue({ data: pdf, error: null });
  const service = createHostedDisc(createWorkspaceClient('https://example.test', 'public-key'));

  await expect(
    service.downloadLegacyEvaluation(
      '10000000-0000-4000-8000-000000000001/perfil-comportamental-1.pdf',
    ),
  ).resolves.toBe(pdf);
  expect(storageFrom).toHaveBeenCalledWith('cali-profiles');
  expect(storageDownload).toHaveBeenCalledWith(
    '10000000-0000-4000-8000-000000000001/perfil-comportamental-1.pdf',
  );
});

test('bloqueia paths com travessia ou fora de PDF antes de acessar Storage', async () => {
  const service = createHostedDisc(createWorkspaceClient('https://example.test', 'public-key'));

  await expect(
    service.downloadLegacyEvaluation('10000000-0000-4000-8000-000000000001/../secret.pdf'),
  ).rejects.toThrow();
  expect(storageFrom).not.toHaveBeenCalled();
});
