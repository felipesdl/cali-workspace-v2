import { z } from 'zod';
import { type WorkspaceClient } from '../../supabase';

const count = z.number().int().nonnegative();
const overviewItem = z.object({
  id: z.uuid(),
  companyId: z.uuid(),
  title: z.string().min(1),
});
export const adminOverviewSnapshot = z.object({
  companyId: z.uuid().nullable(),
  month: z.iso.date(),
  activeAccounts: count,
  pendingActions: count,
  hoursMinutes: z.number().int(),
  contractedMinutes: count,
  hoursByCompany: z
    .array(
      z.object({
        companyId: z.uuid(),
        name: z.string().min(1),
        minutes: z.number().int(),
        contractedMinutes: count,
      }),
    )
    .max(20),
  priorities: z.array(overviewItem.extend({ kind: z.enum(['project', 'record']) })).max(8),
  agenda: z.array(overviewItem.extend({ startsAt: z.iso.datetime({ offset: true }) })).max(8),
  deliverables: z.array(z.object({ status: z.string().min(1), total: count })),
  deadlines: z
    .array(overviewItem.extend({ projectId: z.uuid().nullable(), dueOn: z.iso.date() }))
    .max(8),
  satisfaction: z.object({
    average: z.number().min(1).max(5).nullable(),
    total: count,
    distribution: z
      .array(z.object({ score: z.number().int().min(1).max(5), total: count }))
      .length(5),
  }),
});
export type AdminOverviewSnapshot = z.infer<typeof adminOverviewSnapshot>;
const portfolio = z.object({
  month: z.iso.date(),
  hoursMinutes: z.number().int(),
  calendarEvents: count,
  calendarNotices: count,
  projectAdjustments: count,
  recordsInProgress: count,
  satisfactionAverage: z.number().min(1).max(5).nullable(),
  satisfactionCount: count,
});

export function createAdminPortfolio(client: WorkspaceClient): AdminPortfolioService {
  return {
    async read(month: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_admin_portfolio', { p_month: month })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar o resumo da carteira.');
      const result = portfolio.parse(data);
      if (result.month !== month) throw new Error('Mês divergente.');
      return result;
    },
    async snapshot(companyId, month, signal) {
      const { data, error } = await client
        .rpc('v2_read_admin_overview', {
          p_company_id: companyId,
          p_month: month,
        })
        .abortSignal(signal);
      if (error?.code === 'PGRST202') return null;
      if (error) throw new Error('Não foi possível consultar a Visão geral.');
      const snapshot = adminOverviewSnapshot.parse(data);
      const rows = [
        ...snapshot.hoursByCompany,
        ...snapshot.priorities,
        ...snapshot.agenda,
        ...snapshot.deadlines,
      ];
      if (
        snapshot.companyId !== companyId ||
        snapshot.month !== month ||
        (companyId && rows.some((row) => row.companyId !== companyId))
      ) {
        throw new Error('Recorte da Visão geral divergente.');
      }
      return snapshot;
    },
  };
}

export type AdminPortfolioService = {
  read: (month: string, signal: AbortSignal) => Promise<z.infer<typeof portfolio>>;
  snapshot?: (
    companyId: string | null,
    month: string,
    signal: AbortSignal,
  ) => Promise<AdminOverviewSnapshot | null>;
};
