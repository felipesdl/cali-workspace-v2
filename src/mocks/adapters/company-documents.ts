import {
  type DocumentUpload,
  type DocumentVersion,
  type CompanyDocument,
  type CompanyDocumentEvent,
  type WithdrawCompanyDocument,
} from '../../api/admin/companies/document-schemas';
const actor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export function createCompanyDocumentState() {
  const versions: DocumentVersion[] = [];
  const contents = new Map<string, Blob>();
  const withdrawals = new Map<string, string>();
  const events: CompanyDocumentEvent[] = [];
  function latest(documentId: string) {
    const list = versions.filter((item) => item.documentId === documentId);
    return list[list.length - 1];
  }
  function project(version: DocumentVersion): CompanyDocument {
    return {
      ...version,
      isCurrent: latest(version.documentId)?.id === version.id,
      withdrawn: withdrawals.has(version.documentId),
      withdrawalReason: withdrawals.get(version.documentId) ?? null,
    };
  }
  function record(
    version: DocumentVersion,
    action: CompanyDocumentEvent['action'],
    reason: string | null = null,
  ) {
    events.push({
      id: crypto.randomUUID(),
      companyId: version.companyId,
      documentId: version.documentId,
      versionId: version.id,
      action,
      reason,
      recordedBy: actor,
      recordedAt: new Date().toISOString(),
    });
  }
  return {
    list: (companyId: string) =>
      versions.filter((item) => item.companyId === companyId).map(project),
    history: (companyId: string) => events.filter((item) => item.companyId === companyId),
    currentVersion(companyId: string, versionId: string) {
      const version = versions.find(
        (item) => item.id === versionId && item.companyId === companyId,
      );
      return version ? project(version) : null;
    },
    attach(input: DocumentUpload, file: File) {
      const { command } = input;
      const previous = command.documentId ? latest(command.documentId) : undefined;
      if (
        command.documentId &&
        (!previous ||
          previous.companyId !== command.companyId ||
          previous.id !== command.expectedVersionId ||
          previous.documentType !== command.documentType ||
          withdrawals.has(command.documentId))
      )
        throw new Error(
          'O documento mudou ou foi retirado. Recarregue antes de anexar outra versão.',
        );
      const version: DocumentVersion = {
        id: crypto.randomUUID(),
        companyId: command.companyId,
        documentId: command.documentId ?? crypto.randomUUID(),
        version: (previous?.version ?? 0) + 1,
        documentType: command.documentType,
        documentDate: command.documentDate,
        file: input.file,
        previousVersionId: previous?.id ?? null,
        recordedBy: actor,
        recordedAt: new Date().toISOString(),
      };
      contents.set(version.id, file.slice(0, file.size, input.file.contentType));
      versions.push(version);
      record(version, previous ? 'version_added' : 'attached');
      return project(version);
    },
    withdraw(input: WithdrawCompanyDocument) {
      const version = latest(input.documentId);
      if (
        !version ||
        version.companyId !== input.companyId ||
        version.id !== input.expectedVersionId ||
        withdrawals.has(input.documentId)
      )
        throw new Error('O documento mudou ou já foi retirado. Recarregue a lista.');
      withdrawals.set(input.documentId, input.reason);
      record(version, 'withdrawn', input.reason);
      return project(version);
    },
    content(companyId: string, versionId: string) {
      const version = versions.find(
        (item) => item.companyId === companyId && item.id === versionId,
      );
      const blob = version && contents.get(version.id);
      if (!blob) throw new Error('Arquivo não encontrado nesta empresa.');
      return blob;
    },
  };
}
