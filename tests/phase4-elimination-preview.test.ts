import { createClient } from '@supabase/supabase-js';
import { expect, it } from 'vitest';
import { createDomainOperations } from '../src/api/shared/workspace/domain-operations';

const companyId = '10000000-0000-4000-8000-000000000001';
const base = { companyId, eligible: true, legacyStorageObjects: 3, forms: 2, formsPdfs: 1 };

function previewFrom(response: object) {
  const client = createClient('https://example.supabase.co', 'sb_publishable_test', {
    db: { schema: 'cali_workspace' },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async () =>
        new Response(JSON.stringify(response), {
          headers: { 'Content-Type': 'application/json' },
        }),
    },
  });
  return createDomainOperations(client).previewCompanyElimination(
    companyId,
    new AbortController().signal,
  );
}

it('distingue inventário indisponível de contagem zero e descarta referências brutas', async () => {
  const coverageReview = {
    pathsOutsideLegacy: 1,
    externalReferences: 0,
    discCampaigns: 1,
    discResults: 0,
    discDispatches: 2,
  };
  await expect(previewFrom(base)).resolves.not.toHaveProperty('coverageReview');
  await expect(
    previewFrom({
      ...base,
      coverageReview: { ...coverageReview, paths: ['fixture/file.pdf'] },
    }),
  ).resolves.toEqual({ ...base, coverageReview });
  await expect(
    previewFrom({ ...base, companyId: '10000000-0000-4000-8000-000000000002', coverageReview }),
  ).rejects.toThrow();
});
