import { z } from 'zod';

export const managedLoginSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('create'), inviteId: z.uuid() }),
  z.object({ status: z.literal('ready') }),
  z.object({ status: z.literal('legacy') }),
  z.object({ status: z.literal('unavailable') }),
]);

type ProvisionPorts = {
  prepare: (email: string) => Promise<z.infer<typeof managedLoginSchema>>;
  createUser: (email: string, inviteId: string) => Promise<void>;
};

export async function prepareWorkspaceLogin(email: string, ports: ProvisionPorts) {
  const initial = await ports.prepare(email);
  if (initial.status !== 'create') return initial.status !== 'unavailable';

  try {
    await ports.createUser(email, initial.inviteId);
  } catch {
    // Uma criação concorrente ou resposta perdida pode já ter gravado a conta.
  }

  const confirmed = await ports.prepare(email);
  if (confirmed.status === 'create') throw new Error('Não foi possível provisionar o acesso.');
  return confirmed.status === 'ready';
}
