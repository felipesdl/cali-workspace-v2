import { type WorkspaceAdhesionRecord } from '../../api/modules/access/adhesion';
import { documentVersionSchema } from '../../api/modules/companies/document-schemas';
import {
  adhesionEvidenceStatus,
  type AdhesionEvidence,
  type AdhesionEvidenceRecord,
  type ConfirmAdhesionEvidence,
  type RetractAdhesionEvidence,
} from '../../api/modules/companies/evidence-schemas';
import { type createCompanyDocumentState } from './company-documents';
const actor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export function createAdhesionEvidenceState(
  documents: ReturnType<typeof createCompanyDocumentState>,
  references: WorkspaceAdhesionRecord[],
) {
  const records: AdhesionEvidenceRecord[] = [];
  const retractions = new Map<string, NonNullable<AdhesionEvidence['retraction']>>();
  function project(record: AdhesionEvidenceRecord): AdhesionEvidence {
    const retraction = retractions.get(record.id) ?? null;
    const document =
      record.document && documents.currentVersion(record.companyId, record.document.id);
    function status(): AdhesionEvidence['status'] {
      if (retraction) return adhesionEvidenceStatus.Retracted;
      if (!record.document) return adhesionEvidenceStatus.Valid;
      if (!document || document.withdrawn) return adhesionEvidenceStatus.DocumentWithdrawn;
      if (!document.isCurrent) return adhesionEvidenceStatus.DocumentChanged;
      return adhesionEvidenceStatus.Valid;
    }
    return { ...record, status: status(), retraction };
  }
  function list(companyId: string) {
    return records.filter((item) => item.companyId === companyId).map(project);
  }
  return {
    list,
    canAuthorize: (companyId: string) =>
      list(companyId).some((item) => item.status === adhesionEvidenceStatus.Valid),
    confirm(command: ConfirmAdhesionEvidence) {
      const reference = references.find(
        (item) => item.companyId === command.companyId && item.id === command.adhesionId,
      );
      if (!reference) throw new Error('Referência da adesão não encontrada nesta empresa.');
      const document = command.documentVersionId
        ? documents.currentVersion(command.companyId, command.documentVersionId)
        : null;
      if (command.documentVersionId && (!document || !document.isCurrent || document.withdrawn))
        throw new Error('O documento mudou ou foi retirado. Confira a versão corrente.');
      if (
        list(command.companyId).some(
          (item) =>
            item.status === adhesionEvidenceStatus.Valid &&
            item.reference.id === reference.id &&
            (item.document?.id ?? null) === command.documentVersionId,
        )
      )
        throw new Error('Esta referência e versão já possuem comprovação vigente.');
      const record: AdhesionEvidenceRecord = {
        id: crypto.randomUUID(),
        companyId: command.companyId,
        reference: structuredClone(reference),
        document: document ? documentVersionSchema.strip().parse(document) : null,
        reviewNote: command.reviewNote,
        recordedBy: actor,
        recordedAt: new Date().toISOString(),
      };
      records.push(record);
      return project(record);
    },
    retract(command: RetractAdhesionEvidence) {
      const record = records.find(
        (item) => item.companyId === command.companyId && item.id === command.evidenceId,
      );
      if (!record || retractions.has(record.id))
        throw new Error('Comprovação não encontrada ou já retirada. Recarregue a ficha.');
      retractions.set(record.id, {
        reason: command.reason,
        recordedBy: actor,
        recordedAt: new Date().toISOString(),
      });
      return project(record);
    },
  };
}
