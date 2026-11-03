import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { createCompaniesService } from '../src/api/modules/companies/service';
import { createCompaniesMockAdapter } from '../src/mocks/adapters/companies';
import { createMockHttpClient } from '../src/mocks/http/client';
import { mockCompanyIds } from '../src/mocks/fixtures/companies';
import { type AttachCompanyDocument } from '../src/api/modules/companies/document-schemas';
import { readCompanyBlob } from '../src/api/modules/companies/document-files';
import { createStaticResponseAdapter } from './mocks/http';
beforeAll(() => vi.stubGlobal('crypto', webcrypto));
afterAll(() => vi.unstubAllGlobals());
function setup() {
  const management = createCompaniesService(
    createMockHttpClient(createCompaniesMockAdapter()),
  ).management;
  if (!management) throw new Error('Sem gestão');
  return management.documents;
}
function command(): AttachCompanyDocument {
  return {
    requestId: crypto.randomUUID(),
    companyId: mockCompanyIds.Aurora,
    documentType: 'contract',
    documentDate: null,
    documentId: null,
    expectedVersionId: null,
  };
}
const file = (content = '%PDF-1.4 sintético A') =>
  new File([content], 'contrato.pdf', { type: 'application/pdf' });
describe('arquivos contratuais demonstrativos', () => {
  it('preserva bytes, autoria, histórico e versões; retirada não apaga conteúdo', async () => {
    const documents = setup();
    const input = command();
    const original = file();
    const first = await documents.attach(input, original);
    expect(await documents.attach(input, original)).toEqual(first);
    expect(first).toMatchObject({ version: 1, isCurrent: true, withdrawn: false });
    expect(await readCompanyBlob(await documents.content(first))).toEqual(
      await readCompanyBlob(original),
    );
    const next = await documents.attach(
      {
        ...input,
        requestId: crypto.randomUUID(),
        documentId: first.documentId,
        expectedVersionId: first.id,
        documentDate: '2026-11-03',
      },
      file('%PDF-1.4 sintético B'),
    );
    expect(await documents.list(input.companyId)).toMatchObject([
      { id: first.id, isCurrent: false },
      { id: next.id, isCurrent: true, version: 2 },
    ]);
    const withdrawal = {
      requestId: crypto.randomUUID(),
      companyId: input.companyId,
      documentId: next.documentId,
      expectedVersionId: next.id,
      reason: 'Substituído em conferência',
    };
    expect(await documents.withdraw(withdrawal)).toMatchObject({ withdrawn: true });
    await documents.withdraw(withdrawal);
    expect((await documents.list(input.companyId)).every((item) => item.withdrawn)).toBe(true);
    expect(await readCompanyBlob(await documents.content(first))).toEqual(
      await readCompanyBlob(original),
    );
    expect((await documents.history(input.companyId)).map((item) => item.action)).toEqual([
      'attached',
      'version_added',
      'withdrawn',
    ]);
    expect(await setup().list(input.companyId)).toEqual([]);
  });
  it('requestId inclui digest: mesmos nome/tamanho com outros bytes não sobrescrevem', async () => {
    const documents = setup();
    const input = command();
    await documents.attach(input, file('AAA'));
    await expect(documents.attach(input, file('BBB'))).rejects.toThrow('outros dados');
    expect(await documents.list(input.companyId)).toHaveLength(1);
  });
  it('concorrência aceita uma versão por preimagem e recusa retirada antiga/outra empresa', async () => {
    const documents = setup();
    const input = command();
    const first = await documents.attach(input, file());
    const next = { ...input, documentId: first.documentId, expectedVersionId: first.id };
    const attempts = await Promise.allSettled(
      [1, 2].map((number) =>
        documents.attach({ ...next, requestId: crypto.randomUUID() }, file(`versão ${number}`)),
      ),
    );
    expect(attempts.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    await expect(
      documents.withdraw({
        requestId: crypto.randomUUID(),
        companyId: input.companyId,
        documentId: first.documentId,
        expectedVersionId: first.id,
        reason: 'Preimagem antiga',
      }),
    ).rejects.toThrow('mudou');
    await expect(documents.content({ ...first, companyId: mockCompanyIds.Norte })).rejects.toThrow(
      'não encontrado',
    );
    await expect(
      documents.attach(
        { ...next, companyId: mockCompanyIds.Norte, requestId: crypto.randomUUID() },
        file(),
      ),
    ).rejects.toThrow('mudou');
    expect(await documents.list(mockCompanyIds.Norte)).toEqual([]);
  });
  it('rejeita vazio, formato não aceito, tamanho excessivo e vínculo de resposta divergente', async () => {
    const documents = setup();
    const input = command();
    await expect(documents.attach(input, file(''))).rejects.toThrow('vazio');
    await expect(
      documents.attach(input, new File(['abc'], 'x.exe', { type: 'application/octet-stream' })),
    ).rejects.toThrow();
    await expect(
      documents.attach(
        input,
        new File([new Uint8Array(12 * 1024 * 1024 + 1)], 'grande.pdf', { type: 'application/pdf' }),
      ),
    ).rejects.toThrow('12 MB');
    const first = await documents.attach(input, file());
    const wrong = createCompaniesService(
      createMockHttpClient(createStaticResponseAdapter([first])),
    ).management;
    if (!wrong) throw new Error('Sem gestão');
    await expect(wrong.documents.list(mockCompanyIds.Norte)).rejects.toThrow('outra empresa');
    const corrupted = createCompaniesService(
      createMockHttpClient(createStaticResponseAdapter(new Blob(['bytes divergentes']))),
    ).management;
    if (!corrupted) throw new Error('Sem gestão');
    await expect(corrupted.documents.content(first)).rejects.toThrow('não corresponde');
  });
});
