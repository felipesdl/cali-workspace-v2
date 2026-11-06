import { decodePdf, pdfPayload } from './pdf-payload';
import { z } from 'zod';
import { type WorkspaceClient } from '../../supabase';

const maxPdfBytes = 2 * 1024 * 1024;
const revision = z.object({
  id: z.uuid(),
  number: z.number().int().positive(),
  fileName: z.string(),
});
const documentRow = revision.omit({ id: true }).extend({
  id: z.uuid(),
  title: z.string(),
  revisionId: z.uuid(),
  publishedRevision: z.uuid().nullable(),
  acknowledged: z.boolean(),
});
export type PilotDocument = z.infer<typeof documentRow>;

function errorMessage(code?: string) {
  if (code === '40001') return new Error('O documento mudou. Recarregue e tente novamente.');
  if (code === 'PGRST202') return new Error('PDF do entregável ainda indisponível neste ambiente.');
  if (code === '42501') return new Error('Esta versão está indisponível para o seu acesso.');
  if (code === '22023') return new Error('Confira os dados e selecione um PDF de até 2 MiB.');
  return new Error('Não foi possível concluir a operação de documento.');
}

async function encodePdf(file: File) {
  if (file.size < 8 || file.size > maxPdfBytes || !file.name.toLowerCase().endsWith('.pdf'))
    throw new Error('Selecione um PDF de até 2 MiB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

export function createDocumentOperations(client: WorkspaceClient) {
  return {
    async list(company: string, page: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_list_pilot_documents', {
          p_company_id: company,
          p_page: page,
        })
        .abortSignal(signal);
      if (error) throw errorMessage(error.code);
      return z.array(documentRow).parse(data);
    },
    async delivery(company: string, deliveryId: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pilot_delivery_pdf_info', {
          p_company_id: company,
          p_delivery_id: deliveryId,
        })
        .abortSignal(signal);
      if (error) throw errorMessage(error.code);
      return documentRow.nullable().parse(data);
    },
    async addDelivery(
      company: string,
      deliveryId: string,
      document: string,
      id: string,
      expected: string | null,
      file: File,
    ) {
      const { data, error } = await client.rpc('v2_add_pilot_delivery_pdf', {
        p_company_id: company,
        p_delivery_id: deliveryId,
        p_document_id: document,
        p_revision_id: id,
        p_expected_latest: expected,
        p_file_name: file.name,
        p_pdf_base64: await encodePdf(file),
      });
      if (error) throw errorMessage(error.code);
      return z.uuid().parse(data);
    },
    async history(company: string, document: string, page: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_list_pilot_document_history', {
          p_company_id: company,
          p_document_id: document,
          p_page: page,
        })
        .abortSignal(signal);
      if (error) throw errorMessage(error.code);
      return z.array(revision).parse(data);
    },
    async add(
      company: string,
      document: string,
      id: string,
      expected: string | null,
      title: string,
      file: File,
    ) {
      const { data, error } = await client.rpc('v2_add_pilot_document_revision', {
        p_company_id: company,
        p_document_id: document,
        p_revision_id: id,
        p_expected_latest: expected,
        p_title: title,
        p_file_name: file.name,
        p_pdf_base64: await encodePdf(file),
      });
      if (error) throw errorMessage(error.code);
      return z.uuid().parse(data);
    },
    async publication(
      company: string,
      document: string,
      expected: string | null,
      next: string | null,
    ) {
      const { data, error } = await client.rpc('v2_set_pilot_document_publication', {
        p_company_id: company,
        p_document_id: document,
        p_expected_published: expected,
        p_next_revision: next,
      });
      if (error) throw errorMessage(error.code);
      return z.uuid().parse(data);
    },
    async download(company: string, document: string, revisionId: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pilot_document_pdf', {
          p_company_id: company,
          p_document_id: document,
          p_revision_id: revisionId,
        })
        .abortSignal(signal);
      if (error) throw errorMessage(error.code);
      const result = pdfPayload.parse(data);
      if (result.id !== revisionId) throw errorMessage();
      return decodePdf(result);
    },
    async acknowledge(company: string, document: string, revisionId: string) {
      const { data, error } = await client.rpc('v2_ack_pilot_document', {
        p_company_id: company,
        p_document_id: document,
        p_revision_id: revisionId,
      });
      if (error) throw errorMessage(error.code);
      return z.uuid().parse(data);
    },
  };
}
export type DocumentOperations = ReturnType<typeof createDocumentOperations>;
