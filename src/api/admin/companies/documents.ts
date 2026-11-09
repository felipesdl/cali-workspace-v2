import { type AxiosInstance } from 'axios';
import { z } from 'zod';
import {
  attachDocumentSchema,
  companyDocumentSchema,
  documentEventSchema,
  withdrawDocumentSchema,
  type AttachCompanyDocument,
  type CompanyDocument,
  type WithdrawCompanyDocument,
} from './document-schemas';
import { describeCompanyFile, companyFileDigest } from './document-files';
export function createCompanyDocuments(client: AxiosInstance) {
  return {
    async list(companyId: string, signal?: AbortSignal) {
      const id = z.uuid().parse(companyId);
      // eslint-disable-next-line no-restricted-syntax -- Resposta de transporte validada antes do consumo.
      const response = await client.get<unknown>(`/companies/${id}/documents`, { signal });
      const result = z.array(companyDocumentSchema).parse(response.data);
      if (result.some((item) => item.companyId !== id))
        throw new Error('Arquivos de outra empresa recusados.');
      return result;
    },
    async attach(input: AttachCompanyDocument, file: File) {
      const command = attachDocumentSchema.parse(input);
      const description = await describeCompanyFile(file);
      const body = new FormData();
      body.append('metadata', JSON.stringify({ command, file: description }));
      body.append('file', file);
      // eslint-disable-next-line no-restricted-syntax -- FormData virtual e metadados confirmados por schema/vínculo.
      const response = await client.post<unknown>(
        `/companies/${command.companyId}/documents`,
        body,
      );
      const result = companyDocumentSchema.parse(response.data);
      if (
        result.companyId !== command.companyId ||
        result.documentType !== command.documentType ||
        result.documentDate !== command.documentDate ||
        result.previousVersionId !== command.expectedVersionId ||
        (command.documentId && result.documentId !== command.documentId) ||
        JSON.stringify(result.file) !== JSON.stringify(description)
      )
        throw new Error('Não foi possível confirmar o arquivo. Recarregue a lista.');
      return result;
    },
    async withdraw(input: WithdrawCompanyDocument) {
      const command = withdrawDocumentSchema.parse(input);
      // eslint-disable-next-line no-restricted-syntax -- Resposta de transporte validada por schema e solicitação.
      const response = await client.post<unknown>(
        `/companies/${command.companyId}/documents/${command.documentId}/withdraw`,
        command,
      );
      const result = companyDocumentSchema.parse(response.data);
      if (
        result.companyId !== command.companyId ||
        result.documentId !== command.documentId ||
        result.id !== command.expectedVersionId ||
        !result.withdrawn ||
        result.withdrawalReason !== command.reason
      )
        throw new Error('Não foi possível confirmar a retirada.');
      return result;
    },
    async content(input: CompanyDocument) {
      const item = companyDocumentSchema.parse(input);
      // eslint-disable-next-line no-restricted-syntax -- Blob bruto validado antes de disponibilizar download explícito.
      const response = await client.get<unknown>(
        `/companies/${item.companyId}/documents/${item.id}/content`,
        { responseType: 'blob' },
      );
      const blob = response.data;
      if (
        !(blob instanceof Blob) ||
        blob.size !== item.file.bytes ||
        (await companyFileDigest(blob)) !== item.file.sha256
      )
        throw new Error('O conteúdo recebido não corresponde à versão selecionada.');
      return blob;
    },
    async history(companyId: string, signal?: AbortSignal) {
      const id = z.uuid().parse(companyId);
      // eslint-disable-next-line no-restricted-syntax -- Histórico bruto validado por schema e empresa.
      const response = await client.get<unknown>(`/companies/${id}/document-history`, { signal });
      const result = z.array(documentEventSchema).parse(response.data);
      if (result.some((item) => item.companyId !== id))
        throw new Error('Histórico documental de outra empresa recusado.');
      return result;
    },
  };
}
