import { type AxiosInstance } from 'axios';
import { z } from 'zod';
import {
  adhesionEvidenceSchema,
  adhesionEvidenceStatus,
  confirmAdhesionEvidenceSchema,
  retractAdhesionEvidenceSchema,
  type ConfirmAdhesionEvidence,
  type RetractAdhesionEvidence,
} from './evidence-schemas';
export function createAdhesionEvidence(client: AxiosInstance) {
  return {
    async list(companyId: string, signal?: AbortSignal) {
      const id = z.uuid().parse(companyId);
      // eslint-disable-next-line no-restricted-syntax -- Transporte bruto validado antes de consumir.
      const response = await client.get<unknown>(`/companies/${id}/adhesion-evidence`, { signal });
      const result = z.array(adhesionEvidenceSchema).parse(response.data);
      if (result.some((item) => item.companyId !== id))
        throw new Error('Comprovações de outra empresa recusadas.');
      return result;
    },
    async confirm(input: ConfirmAdhesionEvidence) {
      const command = confirmAdhesionEvidenceSchema.parse(input);
      // eslint-disable-next-line no-restricted-syntax -- Transporte bruto validado por schema e comando.
      const response = await client.post<unknown>(
        `/companies/${command.companyId}/adhesion-evidence`,
        command,
      );
      const result = adhesionEvidenceSchema.parse(response.data);
      if (
        result.companyId !== command.companyId ||
        result.reference.id !== command.adhesionId ||
        (result.document?.id ?? null) !== command.documentVersionId ||
        result.reviewNote !== command.reviewNote ||
        result.status !== adhesionEvidenceStatus.Valid
      )
        throw new Error('Não foi possível confirmar a comprovação administrativa.');
      return result;
    },
    async retract(input: RetractAdhesionEvidence) {
      const command = retractAdhesionEvidenceSchema.parse(input);
      // eslint-disable-next-line no-restricted-syntax -- Transporte bruto validado por schema e comando.
      const response = await client.post<unknown>(
        `/companies/${command.companyId}/adhesion-evidence/${command.evidenceId}`,
        command,
      );
      const result = adhesionEvidenceSchema.parse(response.data);
      if (
        result.id !== command.evidenceId ||
        result.companyId !== command.companyId ||
        result.status !== adhesionEvidenceStatus.Retracted ||
        result.retraction?.reason !== command.reason
      )
        throw new Error('Não foi possível confirmar a retirada da comprovação.');
      return result;
    },
  };
}
