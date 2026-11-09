import { z } from 'zod';
import { type WorkspaceClient } from '../../supabase';

const ownProfile = z.object({
  id: z.uuid(),
  full_name: z.string().nullable(),
  job_title: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
});

export function createOwnProfileService(client: WorkspaceClient) {
  return {
    async read(actor: string, signal: AbortSignal) {
      const { data, error } = await client
        .from('profiles')
        .select('id,full_name,job_title,email,phone,whatsapp')
        .eq('id', actor)
        .abortSignal(signal)
        .maybeSingle();
      if (error) throw new Error('Não foi possível consultar seu perfil.');
      const result = ownProfile.nullable().parse(data);
      if (result && result.id !== actor) throw new Error('Perfil incompatível com a sessão.');
      return result;
    },
  };
}

export type OwnProfileService = ReturnType<typeof createOwnProfileService>;
