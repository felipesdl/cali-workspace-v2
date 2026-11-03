import { type AxiosInstance } from 'axios';
import { z } from 'zod';
import {
  administrationSchema,
  administrationEventSchema,
  updateAdministrationSchema,
  type UpdateAdministration,
} from './administration-schemas';

export function createCompanyAdministration(client: AxiosInstance) {
  return {
    async read(companyId: string, signal?: AbortSignal) {
      const id = z.uuid().parse(companyId);
      // eslint-disable-next-line no-restricted-syntax -- Transporte bruto validado antes do consumo.
      const response = await client.get<unknown>(`/companies/${id}/administration`, { signal });
      const result = administrationSchema.parse(response.data);
      if (result.companyId !== id) throw new Error('Ficha de outra empresa recusada.');
      return result;
    },
    async update(input: UpdateAdministration) {
      const value = updateAdministrationSchema.parse(input);
      // eslint-disable-next-line no-restricted-syntax -- Transporte bruto validado por schema e confirmação dos valores.
      const response = await client.patch<unknown>(
        `/companies/${value.companyId}/administration`,
        value,
      );
      const result = administrationSchema.parse(response.data);
      if (
        result.companyId !== value.companyId ||
        ![value.expectedRevision, value.expectedRevision + 1].includes(result.revision) ||
        JSON.stringify(result.values) !== JSON.stringify(value.values)
      )
        throw new Error('Não foi possível confirmar a ficha administrativa. Recarregue os dados.');
      return result;
    },
    async history(companyId: string, signal?: AbortSignal) {
      const id = z.uuid().parse(companyId);
      // eslint-disable-next-line no-restricted-syntax -- Transporte bruto validado antes do consumo.
      const response = await client.get<unknown>(`/companies/${id}/administration-history`, {
        signal,
      });
      const result = z.array(administrationEventSchema).parse(response.data);
      if (
        result.some(
          (event) =>
            event.companyId !== id ||
            event.previous.companyId !== id ||
            event.current.companyId !== id,
        )
      )
        throw new Error('Histórico de outra empresa recusado.');
      return result;
    },
  };
}
