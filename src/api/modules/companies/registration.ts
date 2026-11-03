import { type AxiosInstance } from 'axios';
import { z } from 'zod';
import {
  registrationSchema,
  registrationEventSchema,
  updateRegistrationSchema,
  type UpdateRegistration,
} from './registration-schemas';

export function createCompanyRegistration(client: AxiosInstance) {
  return {
    async read(companyId: string, signal?: AbortSignal) {
      const id = z.uuid().parse(companyId);
      // eslint-disable-next-line no-restricted-syntax -- Transporte bruto validado antes do consumo.
      const response = await client.get<unknown>(`/companies/${id}/registration`, { signal });
      const result = registrationSchema.parse(response.data);
      if (result.companyId !== id) throw new Error('Cadastro de outra empresa recusado.');
      return result;
    },
    async update(input: UpdateRegistration) {
      const value = updateRegistrationSchema.parse(input);
      // eslint-disable-next-line no-restricted-syntax -- Transporte bruto validado por schema e confirmação dos valores.
      const response = await client.patch<unknown>(
        `/companies/${value.companyId}/registration`,
        value,
      );
      const result = registrationSchema.parse(response.data);
      if (
        result.companyId !== value.companyId ||
        ![value.expectedRevision, value.expectedRevision + 1].includes(result.revision) ||
        JSON.stringify(result.values) !== JSON.stringify(value.values)
      )
        throw new Error('Não foi possível confirmar os dados cadastrais. Recarregue os dados.');
      return result;
    },
    async history(companyId: string, signal?: AbortSignal) {
      const id = z.uuid().parse(companyId);
      // eslint-disable-next-line no-restricted-syntax -- Transporte bruto validado antes do consumo.
      const response = await client.get<unknown>(`/companies/${id}/registration-history`, {
        signal,
      });
      const result = z.array(registrationEventSchema).parse(response.data);
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
