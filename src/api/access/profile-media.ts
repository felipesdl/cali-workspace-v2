import { z } from 'zod';
import { type WorkspaceClient } from '../supabase';

const imageUrl = z
  .union([z.url(), z.literal('')])
  .nullish()
  .transform((value) => value || null);
export const profileMedia = z.object({
  avatar_url: imageUrl,
  avatar_position_x: z
    .number()
    .min(0)
    .max(100)
    .nullish()
    .transform((value) => value ?? 50),
  avatar_position_y: z
    .number()
    .min(0)
    .max(100)
    .nullish()
    .transform((value) => value ?? 50),
  avatar_zoom: z
    .number()
    .min(1)
    .max(3)
    .nullish()
    .transform((value) => value ?? 1),
  signature_mode: z
    .enum(['generated', 'uploaded'])
    .nullish()
    .transform((value) => value ?? 'generated'),
  signature_url: imageUrl,
  signature_style: z
    .enum([
      'executive',
      'editorial',
      'notarial',
      'heritage',
      'calligraphic',
      'autograph',
      'contemporary',
      'italian',
      'minimal',
      'personal',
      'classic',
      'fluid',
      'delicate',
      'formal',
    ])
    .nullish()
    .transform((value) => value ?? 'calligraphic'),
});
export type ProfileMedia = z.infer<typeof profileMedia>;
export const ownProfileMediaKey = (actor?: string) => ['own-profile-media', actor] as const;

export function createProfileMedia(client: WorkspaceClient) {
  return {
    async read(actor: string, signal: AbortSignal) {
      const { data, error } = await client
        .from('profiles')
        .select(
          'avatar_url,avatar_position_x,avatar_position_y,avatar_zoom,signature_mode,signature_url,signature_style',
        )
        .eq('id', actor)
        .abortSignal(signal)
        .single();
      if (error) throw new Error('Não foi possível consultar foto e assinatura.');
      return profileMedia.parse(data);
    },
    async upload(actor: string, kind: 'avatar' | 'signature', file: Blob) {
      if (!['image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024)
        throw new Error('A imagem deve ter até 2 MiB.');
      const path = `${actor}/${kind}-${crypto.randomUUID()}.${file.type === 'image/png' ? 'png' : 'webp'}`;
      const { error } = await client.storage
        .from('workspace-assets')
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw new Error('Não foi possível enviar a imagem.');
      return client.storage.from('workspace-assets').getPublicUrl(path).data.publicUrl;
    },
    async save(expected: ProfileMedia, next: ProfileMedia) {
      const { data, error } = await client.rpc('v2_update_own_profile_media', {
        p_expected: expected,
        p_values: profileMedia.parse(next),
      });
      if (error?.code === '40001')
        throw new Error('A foto ou assinatura mudou em outra sessão. Recarregue antes de salvar.');
      if (error) throw new Error('Não foi possível salvar foto e assinatura.');
      return profileMedia.parse(data);
    },
  };
}
export type ProfileMediaService = ReturnType<typeof createProfileMedia>;
