import { z } from 'zod';
import type { WorkspaceClient } from '../../supabase';

const partnerList = z.object({
  partners: z.array(z.object({ inviteId: z.uuid(), name: z.string() })),
});
const assignment = z.object({
  recordId: z.uuid(),
  revision: z.number().int().positive().nullable(),
  inviteId: z.uuid().nullable(),
  partnerName: z.string().nullable(),
  draftStatus: z.string().nullable(),
});
const drafts = z.object({
  total: z.number().int().nonnegative(),
  entries: z.array(
    z.object({
      id: z.uuid(),
      recordId: z.uuid(),
      assignmentRevision: z.number().int().positive(),
      scopeRevision: z.number().int().nonnegative(),
      currentScopeRevision: z.number().int().nonnegative(),
      protocol: z.string(),
      recordStatus: z.string(),
      partnerName: z.string(),
      opinion: z.string(),
      status: z.string(),
      submittedAt: z.iso.datetime({ offset: true }),
      decisionNote: z.string().nullable(),
    }),
  ),
});

export function createAdminMapaOpinions(client: WorkspaceClient) {
  return {
    async partners(company: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_list_pilot_mapa_partners', { p_company: z.uuid().parse(company) })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar Partners sintéticos atribuíveis.');
      return partnerList.parse(data).partners;
    },
    async assignment(company: string, record: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pilot_mapa_assignment', {
          p_company: z.uuid().parse(company),
          p_record: z.uuid().parse(record),
        })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar atribuição Mapa.');
      return assignment.parse(data);
    },
    async assign(company: string, record: string, scopeRevision: number, invite: string) {
      const { data, error } = await client.rpc('v2_assign_pilot_mapa_partner', {
        p_company: z.uuid().parse(company),
        p_record: z.uuid().parse(record),
        p_scope_revision: z.number().int().nonnegative().parse(scopeRevision),
        p_invite: z.uuid().parse(invite),
      });
      if (error?.code === '40001') throw new Error('O registro mudou. Atualize antes de atribuir.');
      if (error) throw new Error('Não foi possível atribuir o parecer Mapa.');
      return z.uuid().parse(data);
    },
    async drafts(company: string, pageNumber: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_list_pilot_mapa_opinion_drafts', {
          p_company: z.uuid().parse(company),
          p_page: pageNumber,
        })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar pareceres enviados para revisão.');
      return drafts.parse(data);
    },
    async decide(input: {
      company: string;
      record: string;
      assignmentRevision: number;
      scopeRevision: number;
      decision: 'apply' | 'return';
      status: 'novo' | 'em_andamento' | 'cancelado';
      note: string;
    }) {
      const { data, error } = await client.rpc('v2_decide_pilot_mapa_opinion', {
        p_company: z.uuid().parse(input.company),
        p_record: z.uuid().parse(input.record),
        p_assignment_revision: input.assignmentRevision,
        p_scope_revision: input.scopeRevision,
        p_request: crypto.randomUUID(),
        p_decision: input.decision,
        p_status: input.status,
        p_note: input.note,
      });
      if (error?.code === '40001')
        throw new Error('Registro mudou ou parecer já foi decidido. Atualize a fila.');
      if (error) throw new Error('Não foi possível registrar a decisão do parecer.');
      return z.uuid().parse(data);
    },
  };
}
export type AdminMapaOpinions = ReturnType<typeof createAdminMapaOpinions>;
