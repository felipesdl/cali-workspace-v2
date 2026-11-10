import { z } from 'zod';

// Contrato DEC-23: persistência testada no laboratório; SPA demonstrativa consome a referência, sem integração hospedada.
export const registerWorkspaceAdhesionSchema = z.strictObject({
  companyId: z.uuid(),
  evidenceReference: z.string().trim().min(1, 'Informe a referência da adesão.'),
});

// Autoria/instante virão do servidor; não são campos aceitos na solicitação.
export const workspaceAdhesionRecordSchema = z.strictObject({
  id: z.uuid(),
  companyId: z.uuid(),
  evidenceReference: z.string().min(1),
  recordedBy: z.uuid(),
  recordedAt: z.iso.datetime({ offset: true }),
});

export type RegisterWorkspaceAdhesion = z.infer<typeof registerWorkspaceAdhesionSchema>;
export type WorkspaceAdhesionRecord = z.infer<typeof workspaceAdhesionRecordSchema>;
