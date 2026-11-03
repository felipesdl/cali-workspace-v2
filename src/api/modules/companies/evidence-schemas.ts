import { z } from 'zod';
import { workspaceAdhesionRecordSchema } from '../access/adhesion';
import { documentVersionSchema } from './document-schemas';
export const adhesionEvidenceStatus = {
  Valid: 'valid',
  Retracted: 'retracted',
  DocumentChanged: 'document_changed',
  DocumentWithdrawn: 'document_withdrawn',
} as const;
export const confirmAdhesionEvidenceSchema = z.strictObject({
  requestId: z.uuid(),
  companyId: z.uuid(),
  adhesionId: z.uuid(),
  documentVersionId: z.uuid().nullable(),
  reviewNote: z.string().trim().min(1, 'Descreva a conferência realizada.'),
  confirmed: z.literal(true, { error: 'Confirme a conferência administrativa.' }),
});
export const retractAdhesionEvidenceSchema = z.strictObject({
  requestId: z.uuid(),
  companyId: z.uuid(),
  evidenceId: z.uuid(),
  reason: z.string().trim().min(1, 'Informe o motivo da retirada da comprovação.'),
});
export const adhesionEvidenceRecordSchema = z
  .strictObject({
    id: z.uuid(),
    companyId: z.uuid(),
    reference: workspaceAdhesionRecordSchema,
    document: documentVersionSchema.nullable(),
    reviewNote: z.string().trim().min(1),
    recordedBy: z.uuid(),
    recordedAt: z.iso.datetime({ offset: true }),
  })
  .refine(
    (item) =>
      item.reference.companyId === item.companyId &&
      (!item.document || item.document.companyId === item.companyId),
    'Vínculos da comprovação incompatíveis.',
  );
export const adhesionEvidenceSchema = adhesionEvidenceRecordSchema
  .safeExtend({
    status: z.enum(adhesionEvidenceStatus),
    retraction: z
      .strictObject({
        reason: z.string().trim().min(1),
        recordedBy: z.uuid(),
        recordedAt: z.iso.datetime({ offset: true }),
      })
      .nullable(),
  })
  .refine(
    (item) => (item.status === adhesionEvidenceStatus.Retracted) === Boolean(item.retraction),
    'Retirada incompatível com o estado da comprovação.',
  );
export type ConfirmAdhesionEvidence = z.infer<typeof confirmAdhesionEvidenceSchema>;
export type RetractAdhesionEvidence = z.infer<typeof retractAdhesionEvidenceSchema>;
export type AdhesionEvidenceRecord = z.infer<typeof adhesionEvidenceRecordSchema>;
export type AdhesionEvidence = z.infer<typeof adhesionEvidenceSchema>;
