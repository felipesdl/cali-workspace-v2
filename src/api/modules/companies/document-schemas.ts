import { z } from 'zod';
export const companyDocumentType = { Contract: 'contract', Addendum: 'addendum' } as const;
export const maxCompanyDocumentBytes = 12 * 1024 * 1024;
export const acceptedDocumentTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
  'image/svg+xml',
] as const;
export const documentFileSchema = z.strictObject({
  fileName: z.string().trim().min(1, 'Selecione um arquivo.'),
  contentType: z.enum(acceptedDocumentTypes),
  bytes: z
    .number()
    .int()
    .positive('O arquivo está vazio.')
    .max(maxCompanyDocumentBytes, 'Use um arquivo de até 12 MB.'),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});
export const attachDocumentSchema = z
  .strictObject({
    requestId: z.uuid(),
    companyId: z.uuid(),
    documentType: z.enum(companyDocumentType),
    documentDate: z.iso.date().nullable(),
    documentId: z.uuid().nullable(),
    expectedVersionId: z.uuid().nullable(),
  })
  .refine(
    (value) => Boolean(value.documentId) === Boolean(value.expectedVersionId),
    'Informe documento e versão esperada juntos.',
  );
export const documentUploadSchema = z.strictObject({
  command: attachDocumentSchema,
  file: documentFileSchema,
});
export const documentVersionSchema = z.strictObject({
  id: z.uuid(),
  companyId: z.uuid(),
  documentId: z.uuid(),
  version: z.number().int().positive(),
  documentType: z.enum(companyDocumentType),
  documentDate: z.iso.date().nullable(),
  file: documentFileSchema,
  previousVersionId: z.uuid().nullable(),
  recordedBy: z.uuid(),
  recordedAt: z.iso.datetime({ offset: true }),
});
export const companyDocumentSchema = documentVersionSchema.extend({
  isCurrent: z.boolean(),
  withdrawn: z.boolean(),
  withdrawalReason: z.string().nullable(),
});
export const withdrawDocumentSchema = z.strictObject({
  requestId: z.uuid(),
  companyId: z.uuid(),
  documentId: z.uuid(),
  expectedVersionId: z.uuid(),
  reason: z.string().trim().min(1, 'Informe o motivo da retirada.'),
});
export const documentEventSchema = z.strictObject({
  id: z.uuid(),
  companyId: z.uuid(),
  documentId: z.uuid(),
  versionId: z.uuid(),
  action: z.enum(['attached', 'version_added', 'withdrawn']),
  reason: z.string().nullable(),
  recordedBy: z.uuid(),
  recordedAt: z.iso.datetime({ offset: true }),
});
export type AttachCompanyDocument = z.infer<typeof attachDocumentSchema>;
export type CompanyDocumentFile = z.infer<typeof documentFileSchema>;
export type DocumentUpload = z.infer<typeof documentUploadSchema>;
export type DocumentVersion = z.infer<typeof documentVersionSchema>;
export type CompanyDocument = z.infer<typeof companyDocumentSchema>;
export type WithdrawCompanyDocument = z.infer<typeof withdrawDocumentSchema>;
export type CompanyDocumentEvent = z.infer<typeof documentEventSchema>;
