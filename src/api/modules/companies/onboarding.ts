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
const eventBase = z.object({
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
const snapshotSchema = z.object({ draft: draftSchema, history: z.array(eventSchema) });
export type Draft = z.infer<typeof draftSchema>;
export type DraftSnapshot = z.infer<typeof snapshotSchema>;
export type DraftReview =
  ({ action: 'confirmed' } & z.infer<typeof reviewFields>) | { action: 'withdrawn'; note: string };

const loadError = 'Não foi possível consultar os rascunhos. Tente novamente.';
const saveError = 'Não foi possível confirmar a gravação. Tente novamente com os mesmos dados.';
const pageSize = 25;

export function createCompanyOnboarding(client: WorkspaceClient) {
  return {
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
    async review(draftId: string, requestId: string, expected: string | null, input: DraftReview) {
      const id = z.uuid().parse(draftId);
      const fields = input.action === 'confirmed' ? reviewFields.parse(input) : null;
      const note = reviewFields.shape.note.parse(input.note);
      const { data, error } = await client.rpc('v2_review_company_adhesion', {
        p_draft_id: id,
        p_request_id: z.uuid().parse(requestId),
        p_expected_event_id: z.uuid().nullable().parse(expected),
        p_action: input.action,
        p_evidence_reference: fields?.reference ?? null,
        p_document_revision: fields?.revision || null,
        p_note: note,
      });
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
        result.document_revision !== (fields?.revision || null)
      ) {
        throw new Error(saveError);
      }
      return result;
    },
  };
}
