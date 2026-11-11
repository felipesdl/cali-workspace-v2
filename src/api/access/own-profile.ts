import { createProfileMedia } from './profile-media';
import { type WorkspaceClient } from '../supabase';
import {
  ownProfile,
  ownProfileUpdate,
  type OwnProfilePatch,
  type OwnProfileValues,
} from './own-profile-schemas';

export function createOwnProfileService(client: WorkspaceClient, canEdit = false) {
  return {
    media: canEdit ? createProfileMedia(client) : undefined,
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
    update: canEdit
      ? async (actor: string, expected: OwnProfileValues, patch: OwnProfilePatch) => {
          const { data, error } = await client.rpc('v2_update_own_profile', {
            p_expected: expected,
            p_patch: patch,
          });
          if (error) throw new Error('Não foi possível salvar seu perfil. Tente novamente.');
          const result = ownProfileUpdate.parse(data);
          if (result.status === 'saved' && result.profile.id !== actor)
            throw new Error('Perfil incompatível com a sessão.');
          return result;
        }
      : undefined,
  };
}

type Service = ReturnType<typeof createOwnProfileService>;
export type OwnProfileService = Pick<Service, 'read'> & Partial<Pick<Service, 'update' | 'media'>>;
