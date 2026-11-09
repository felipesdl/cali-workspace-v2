import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { createCompaniesService } from '../src/api/admin/companies/service';
import { createCompaniesMockAdapter } from '../src/mocks/adapters/companies';
import { createMockHttpClient } from '../src/mocks/http/client';
import { mockCompanyIds } from '../src/mocks/fixtures/companies';
import { createStaticResponseAdapter } from './mocks/http';
import { confirmAdhesionEvidenceSchema } from '../src/api/admin/companies/evidence-schemas';
beforeAll(() => vi.stubGlobal('crypto', webcrypto));
afterAll(() => vi.unstubAllGlobals());
async function setup() {
  const service = createCompaniesService(createMockHttpClient(createCompaniesMockAdapter()));
  const management = service.management;
  if (!management) throw new Error('Sem gestão');
  const company = await management.create({
    requestId: crypto.randomUUID(),
    values: { displayName: 'Empresa sintética', legalName: '' },
  });
  const reference = await management.registerAdhesion({
    requestId: crypto.randomUUID(),
    companyId: company.id,
    evidenceReference: 'Formalização externa sintética',
  });
  const command = {
    requestId: crypto.randomUUID(),
    companyId: company.id,
    adhesionId: reference.id,
    documentVersionId: null,
    reviewNote: 'Formalização conferida com referência sintética.',
    confirmed: true as const,
  };
  const add = () =>
    management.addAccess({
      requestId: crypto.randomUUID(),
      companyId: company.id,
      values: { name: 'Pessoa sintética', email: 'sintetica@example.test' },
    });
  return { service, management, company, reference, command, add };
}
async function attachment(
  management: NonNullable<ReturnType<typeof createCompaniesService>['management']>,
  companyId: string,
) {
  return management.documents.attach(
    {
      requestId: crypto.randomUUID(),
      companyId,
      documentType: 'contract',
      documentDate: null,
      documentId: null,
      expectedVersionId: null,
    },
    new File(['%PDF-1.4 sintético'], 'contrato.pdf', { type: 'application/pdf' }),
  );
}
describe('comprovação administrativa da adesão', () => {
  it('referência/anexo sozinhos não liberam acesso; conferência externa dispensa upload', async () => {
    const { management, command, add } = await setup();
    await expect(add()).rejects.toThrow('comprovação administrativa');
    const first = await management.evidence.confirm(command);
    expect(first).toMatchObject({
      status: 'valid',
      document: null,
      reviewNote: command.reviewNote,
    });
    expect(first.reference.id).toBe(command.adhesionId);
    expect(await management.evidence.confirm(command)).toEqual(first);
    await expect(
      management.evidence.confirm({ ...command, reviewNote: 'Outra nota' }),
    ).rejects.toThrow('outros dados');
    expect(await add()).toMatchObject({ status: 'active', invitedOn: null });
    expect(confirmAdhesionEvidenceSchema.safeParse({ ...command, confirmed: false }).success).toBe(
      false,
    );
    expect(confirmAdhesionEvidenceSchema.safeParse({ ...command, reviewNote: ' ' }).success).toBe(
      false,
    );
    expect(
      confirmAdhesionEvidenceSchema.safeParse({ ...command, recordedBy: crypto.randomUUID() })
        .success,
    ).toBe(false);
  });
  it('retirada mantém registro, motivo e acesso existente; bloqueia nova autorização/reautorização', async () => {
    const { management, service, company, command, add } = await setup();
    const proof = await management.evidence.confirm(command);
    const grant = await add();
    const retraction = {
      requestId: crypto.randomUUID(),
      companyId: company.id,
      evidenceId: proof.id,
      reason: 'Conferência revisada',
    };
    const withdrawn = await management.evidence.retract(retraction);
    expect(await management.evidence.retract(retraction)).toEqual(withdrawn);
    expect(withdrawn).toMatchObject({
      status: 'retracted',
      reference: proof.reference,
      reviewNote: proof.reviewNote,
      retraction: { reason: retraction.reason },
    });
    expect(await service.accesses(company.id)).toEqual([grant]);
    const revoke = await management.changeAccess({
      requestId: crypto.randomUUID(),
      companyId: company.id,
      accessId: grant.id,
      expected: { name: grant.name, email: grant.email, status: grant.status },
      values: { name: grant.name, status: 'revoked' },
    });
    await expect(
      management.changeAccess({
        requestId: crypto.randomUUID(),
        companyId: company.id,
        accessId: grant.id,
        expected: { name: revoke.name, email: revoke.email, status: revoke.status },
        values: { name: grant.name, status: 'active' },
      }),
    ).rejects.toThrow('comprovação');
    expect(await management.evidence.list(company.id)).toHaveLength(1);
    await management.evidence.confirm({
      ...command,
      requestId: crypto.randomUUID(),
      reviewNote: 'Nova conferência',
    });
    expect(await management.evidence.list(company.id)).toHaveLength(2);
  });
  it('vincula versão/digest; substituição e retirada invalidam apenas comprovações ligadas', async () => {
    const { management, company, command, add } = await setup();
    const document = await attachment(management, company.id);
    await expect(add()).rejects.toThrow('comprovação');
    const linked = { ...command, documentVersionId: document.id };
    const proof = await management.evidence.confirm(linked);
    expect(proof.document?.file.sha256).toBe(document.file.sha256);
    const second = await management.documents.attach(
      {
        requestId: crypto.randomUUID(),
        companyId: company.id,
        documentType: 'contract',
        documentDate: null,
        documentId: document.documentId,
        expectedVersionId: document.id,
      },
      new File(['%PDF-1.4 versão nova'], 'novo.pdf', { type: 'application/pdf' }),
    );
    expect(await management.evidence.list(company.id)).toMatchObject([
      { status: 'document_changed', document: { id: document.id } },
    ]);
    await expect(add()).rejects.toThrow('comprovação');
    await expect(
      management.evidence.confirm({ ...linked, requestId: crypto.randomUUID() }),
    ).rejects.toThrow('mudou');
    await management.evidence.confirm({
      ...command,
      requestId: crypto.randomUUID(),
      documentVersionId: second.id,
    });
    await management.documents.withdraw({
      requestId: crypto.randomUUID(),
      companyId: company.id,
      documentId: second.documentId,
      expectedVersionId: second.id,
      reason: 'Retirado',
    });
    expect(
      (await management.evidence.list(company.id)).every(
        (item) => item.status === 'document_withdrawn',
      ),
    ).toBe(true);
    await management.evidence.confirm({ ...command, requestId: crypto.randomUUID() });
    expect(await add()).toMatchObject({ status: 'active' });
  });
  it('recusa referências/arquivos/comprovações de outra empresa e confirmação concorrente duplicada', async () => {
    const { management, company, command } = await setup();
    await expect(
      management.evidence.confirm({ ...command, companyId: mockCompanyIds.Norte }),
    ).rejects.toThrow('Referência');
    const foreign = await attachment(management, mockCompanyIds.Norte);
    await expect(
      management.evidence.confirm({ ...command, documentVersionId: foreign.id }),
    ).rejects.toThrow('documento');
    const results = await Promise.allSettled(
      [1, 2].map(() => management.evidence.confirm({ ...command, requestId: crypto.randomUUID() })),
    );
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    const [proof] = await management.evidence.list(company.id);
    await expect(
      management.evidence.retract({
        requestId: crypto.randomUUID(),
        companyId: mockCompanyIds.Norte,
        evidenceId: proof.id,
        reason: 'Outra empresa',
      }),
    ).rejects.toThrow('não encontrada');
    const wrong = createCompaniesService(
      createMockHttpClient(createStaticResponseAdapter([proof])),
    ).management;
    if (!wrong) throw new Error('Sem gestão');
    await expect(wrong.evidence.list(mockCompanyIds.Norte)).rejects.toThrow('outra empresa');
  });
});
