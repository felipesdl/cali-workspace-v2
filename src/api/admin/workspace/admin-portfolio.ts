import { z } from 'zod';
import { type WorkspaceClient } from '../../supabase';

const count = z.number().int().nonnegative();
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

export function createAdminPortfolio(client: WorkspaceClient) {
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
  };
}

export type AdminPortfolioService = ReturnType<typeof createAdminPortfolio>;
