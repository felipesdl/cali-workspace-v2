import { z } from 'zod';
import { type WorkspaceClient } from '../../supabase';

export const serviceCycleStatus = {
  Planned: 'planned',
  Open: 'open',
  Review: 'review',
  Closed: 'closed',
} as const;

const serviceCycleRow = z.object({
  id: z.uuid(),
  company_id: z.uuid(),
  reference_month: z.iso.date(),
  contracted_hours: z.number().nonnegative().nullable(),
  status: z.enum(serviceCycleStatus),
});
export type ServiceCycleStatus = z.infer<typeof serviceCycleRow.shape.status>;

export function createOpenCurrentCycle(client: WorkspaceClient) {
  return async (companyId: string) => {
    const { data, error } = await client.rpc('v2_open_current_service_cycle', {
      p_company_id: z.uuid().parse(companyId),
    });
    if (error?.code === '55000')
      throw new Error('A empresa precisa estar ativa e ter horas contratadas.');
    if (error) throw new Error('Não foi possível confirmar a abertura do ciclo.');
    return z.uuid().parse(data);
  };
}

export function createHostedCycles(client: WorkspaceClient) {
  return async (companyId: string, signal: AbortSignal) => {
    const id = z.uuid().parse(companyId);
    const { data, error } = await client
      .from('service_cycles')
      .select('id,company_id,reference_month,contracted_hours,status')
      .eq('company_id', id)
      .order('reference_month', { ascending: false })
      .limit(12)
      .abortSignal(signal);
    if (error) throw new Error('Não foi possível consultar os ciclos desta empresa.');
    return z
      .array(serviceCycleRow)
      .max(12)
      .parse(data)
      .map((row) => {
        if (row.company_id !== id) throw new Error('Ciclo incompatível com a empresa selecionada.');
        return {
          id: row.id,
          month: row.reference_month,
          hours: row.contracted_hours,
          status: row.status,
        };
      });
  };
}
