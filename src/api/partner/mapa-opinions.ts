import { z } from 'zod';
import type { WorkspaceClient } from '../supabase';

const score = z.number().min(0).max(10);
const diagnostic = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  dimensions: z.array(score).length(4),
  score: score,
  protocol: z.string(),
  createdAt: z.iso.datetime({ offset: true }),
  observations: z.array(z.string().nullable()).length(4),
  recommendedService: z.string(),
});
const opinion = z.object({
  id: z.uuid().nullable(),
  record_id: z.uuid(),
  company_id: z.uuid(),
  assignment_revision: z.number().int().positive(),
  scope_revision: z.number().int().nonnegative(),
  protocol: z.string(),
  record_status: z.string(),
  createdAt: z.iso.datetime({ offset: true }),
  draft_status: z.enum(['draft', 'submitted', 'approved', 'returned', 'superseded']).nullable(),
  opinion: z.string().nullable(),
  decision_note: z.string().nullable(),
  submitted_at: z.iso.datetime({ offset: true }).nullable(),
  diagnostic,
});
const page = z.object({ total: z.number().int().nonnegative(), entries: z.array(opinion) });

export function createPartnerMapaOpinions(client: WorkspaceClient) {
  return {
    async list(pageNumber: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_list_partner_mapa_opinions', { p_page: pageNumber })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar os pareceres Mapa atribuídos.');
      return page.parse(data);
    },
    async save(input: {
      recordId: string;
      assignmentRevision: number;
      requestId: string;
      action: 'save' | 'submit';
      opinion: string;
    }) {
      const { data, error } = await client.rpc('v2_save_partner_mapa_opinion', {
        p_record: z.uuid().parse(input.recordId),
        p_assignment_revision: z.number().int().positive().parse(input.assignmentRevision),
        p_request: z.uuid().parse(input.requestId),
        p_action: input.action,
        p_opinion: z.string().max(4000).parse(input.opinion),
      });
      if (error?.code === '40001') throw new Error('A atribuição mudou. Atualize o parecer.');
      if (error) throw new Error('Não foi possível salvar o parecer privado.');
      return z.uuid().parse(data);
    },
  };
}

export type PartnerMapaOpinions = ReturnType<typeof createPartnerMapaOpinions>;
