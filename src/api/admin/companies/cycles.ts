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
export type ServiceCycle = {
  id: string;
  month: string;
  hours: number | null;
  status: ServiceCycleStatus;
};
export const nextCycleStatus = {
  [serviceCycleStatus.Planned]: serviceCycleStatus.Open,
  [serviceCycleStatus.Open]: serviceCycleStatus.Review,
  [serviceCycleStatus.Review]: serviceCycleStatus.Closed,
  [serviceCycleStatus.Closed]: null,
} satisfies Record<ServiceCycleStatus, ServiceCycleStatus | null>;

export function createTransitionServiceCycle(client: WorkspaceClient) {
  return async (companyId: string, cycleId: string, expectedStatus: ServiceCycleStatus) => {
    const expected = serviceCycleRow.shape.status.parse(expectedStatus);
    const next = nextCycleStatus[expected];
    if (!next) throw new Error('O ciclo já está encerrado.');
    const { data, error } = await client.rpc('v2_transition_service_cycle', {
      p_company_id: z.uuid().parse(companyId),
      p_cycle_id: z.uuid().parse(cycleId),
      p_expected_status: expected,
      p_next_status: next,
    });
    if (error?.code === '40001') throw new Error('A situação do ciclo mudou. Confira a ficha.');
    if (error?.code === '55000')
      throw new Error('Confira a situação da empresa e as horas do ciclo.');
    if (error || data !== cycleId)
      throw new Error('Não foi possível confirmar a mudança do ciclo.');
  };
}

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
  return async (companyId: string, signal: AbortSignal): Promise<ServiceCycle[]> => {
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
