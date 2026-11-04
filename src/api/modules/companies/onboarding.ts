import { z } from 'zod';
import { type WorkspaceClient } from '../../supabase';
import { companyBasicFieldsSchema } from './schemas';

export const draftFields = companyBasicFieldsSchema.extend({
  displayName: companyBasicFieldsSchema.shape.displayName.max(200),
  legalName: companyBasicFieldsSchema.shape.legalName.max(200),
});
export const reviewFields = z.object({
  reference: z.string().trim().min(1).max(1000),
  revision: z.string().trim().max(250),
  note: z.string().trim().min(1).max(2000),
});
const draftSchema = z.object({
  id: z.uuid(),
  display_name: z.string(),
  legal_name: z.string(),
  recorded_at: z.iso.datetime({ offset: true }),
  recorded_by: z.uuid(),
});
const documentSchema = z.object({
  document_id: z.uuid(),
  object_id: z.uuid(),
  version: z.string().min(1).max(250),
  title: z.string(),
  document_type: z.enum(['contract', 'addendum']),
});
export type AdhesionDocument = z.infer<typeof documentSchema>;
const eventBase = z.object({
  document_snapshot: documentSchema.nullable().default(null),
  id: z.uuid(),
  draft_id: z.uuid(),
  note: z.string(),
  recorded_at: z.iso.datetime({ offset: true }),
  recorded_by: z.uuid(),
});
const eventSchema = z.discriminatedUnion('action', [
  eventBase.extend({
    action: z.literal('confirmed'),
    previous_event_id: z.uuid().nullable(),
    evidence_reference: z.string(),
    document_revision: z.string().nullable(),
  }),
  eventBase.extend({
    action: z.literal('withdrawn'),
    previous_event_id: z.uuid(),
    evidence_reference: z.null(),
    document_revision: z.null(),
  }),
]);
const snapshotSchema = z.object({
  draft: draftSchema.extend({ company_id: z.uuid().nullable().default(null) }),
  history: z.array(eventSchema),
});
export type Draft = z.infer<typeof draftSchema>;
export type DraftSnapshot = z.infer<typeof snapshotSchema>;
export type DraftReview =
  | ({ action: 'confirmed'; document?: AdhesionDocument } & z.infer<typeof reviewFields>)
  | { action: 'withdrawn'; note: string };

const loadError = 'Não foi possível consultar os rascunhos. Tente novamente.';
const saveError = 'Não foi possível confirmar a gravação. Tente novamente com os mesmos dados.';
const pageSize = 25;
const pilotCompanyIdSchema = z.enum([
  '9c5ab148-78b8-4410-9338-58c44222a5db',
  '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76',
]);
export const isPilotCompany = (companyId: string | undefined) =>
  pilotCompanyIdSchema.safeParse(companyId).success;

export function createCompanyOnboarding(client: WorkspaceClient) {
  return {
    async preparePilotDocument(companyId: string) {
      const { preparePilotDocument } = await import('./pilot-document');
      return preparePilotDocument(client, pilotCompanyIdSchema.parse(companyId));
    },
    async preparePilotDraft(companyId: string) {
      const { data, error } = await client.rpc('v2_prepare_pilot_company_draft', {
        p_company_id: pilotCompanyIdSchema.parse(companyId),
      });
      if (error) throw new Error('Não foi possível preparar o rascunho de teste.');
      return z.uuid().parse(data);
    },
    async list(before: string | null, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_list_company_drafts', before ? { p_before: z.uuid().parse(before) } : {}, {
          get: true,
        })
        .abortSignal(signal);
      if (error) throw new Error(loadError);
      const rows = z
        .array(draftSchema)
        .max(pageSize + 1)
        .parse(data);
      const items = rows.slice(0, pageSize);
      return { items, next: rows.length > pageSize ? items[pageSize - 1].id : null };
    },
    async read(draftId: string, signal: AbortSignal) {
      const id = z.uuid().parse(draftId);
      const { data, error } = await client
        .rpc('v2_read_company_draft', { p_draft_id: id }, { get: true })
        .abortSignal(signal);
      if (error) throw new Error(loadError);
      const result = snapshotSchema.nullable().parse(data);
      if (
        result &&
        (result.draft.id !== id || result.history.some((event) => event.draft_id !== id))
      ) {
        throw new Error('Resposta incompatível com o rascunho selecionado.');
      }
      return result;
    },
    async create(requestId: string, input: z.input<typeof draftFields>) {
      const { displayName, legalName } = draftFields.parse(input);
      const { data, error } = await client.rpc('v2_create_company_draft', {
        p_request_id: z.uuid().parse(requestId),
        p_display_name: displayName,
        p_legal_name: legalName,
      });
      if (error) throw new Error(saveError);
      const draft = draftSchema.parse(data);
      if (draft.display_name !== displayName || draft.legal_name !== (legalName || displayName)) {
        throw new Error(saveError);
      }
      return draft;
    },
    async materialize(draftId: string) {
      const { data, error } = await client.rpc('v2_materialize_company', {
        p_draft_id: z.uuid().parse(draftId),
      });
      if (error?.code === '55000') throw new Error('A empresa vinculada está indisponível.');
      if (error) throw new Error('Não foi possível confirmar a criação. Tente novamente.');
      return z.uuid().parse(data);
    },
    async documents(draftId: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc(
          'v2_list_adhesion_documents',
          {
            p_draft_id: z.uuid().parse(draftId),
          },
          { get: true },
        )
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar os documentos.');
      return z.array(documentSchema).parse(data);
    },
    async review(draftId: string, requestId: string, expected: string | null, input: DraftReview) {
      const id = z.uuid().parse(draftId);
      const fields = input.action === 'confirmed' ? reviewFields.parse(input) : null;
      const note = reviewFields.shape.note.parse(input.note);
      const document =
        input.action === 'confirmed' && input.document
          ? documentSchema.parse(input.document)
          : null;
      const args = {
        p_draft_id: id,
        p_request_id: z.uuid().parse(requestId),
        p_expected_event_id: z.uuid().nullable().parse(expected),
        p_note: note,
      };
      const { data, error } =
        document && fields
          ? await client.rpc('v2_confirm_adhesion_document', {
              ...args,
              p_reference: fields.reference,
              p_document_id: document.document_id,
              p_object_id: document.object_id,
              p_version: document.version,
            })
          : await client.rpc('v2_review_company_adhesion', {
              ...args,
              p_action: input.action,
              p_evidence_reference: fields?.reference ?? null,
              p_document_revision: fields?.revision || null,
            });
      if (error?.code === '55000') {
        throw new Error(
          'A versão mudou ou ficou indisponível. Atualize os documentos e confira novamente.',
        );
      }
      if (error?.code === '40001') {
        throw new Error('A comprovação mudou. Feche o formulário e atualize o histórico.');
      }
      if (error) throw new Error(saveError);
      const result = eventSchema.parse(data);
      if (
        result.draft_id !== id ||
        result.action !== input.action ||
        result.previous_event_id !== expected ||
        result.note !== note ||
        result.evidence_reference !== (fields?.reference ?? null) ||
        result.document_revision !== (document?.version ?? (fields?.revision || null)) ||
        (result.document_snapshot?.document_id ?? null) !== (document?.document_id ?? null) ||
        (result.document_snapshot?.object_id ?? null) !== (document?.object_id ?? null) ||
        (result.document_snapshot?.version ?? null) !== (document?.version ?? null)
      ) {
        throw new Error(saveError);
      }
      return result;
    },
  };
}
