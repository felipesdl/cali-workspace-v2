import { z } from 'zod';
import { type WorkspaceClient } from '../../supabase';
import { companyService, logoSchema, type CompanyLogo } from './registration-schemas';

const contactSchema = z.object({
  name: z.string().trim().max(254),
  title: z.string().trim().max(254),
  email: z.union([z.literal(''), z.email().max(254)]),
  phone: z.string().trim().max(50),
  whatsapp: z.string().trim().max(50),
  birthday: z.iso.date().nullable(),
});
const brandSchema = z.object({
  companyId: z.uuid(),
  updatedAt: z.iso.datetime({ offset: true }),
  service: z.string().nullable(),
  plan: z.string().nullable(),
  hasLogo: z.boolean(),
  contact: contactSchema,
});
export type HostedBrand = z.infer<typeof brandSchema>;
export const hostedBrandDraft = z.object({
  service: z.union([z.literal(''), z.enum(companyService)]),
  contact: contactSchema.extend({ birthday: z.union([z.literal(''), z.iso.date()]) }),
});
export type HostedBrandDraft = z.infer<typeof hostedBrandDraft>;
export type LogoChange = { action: 'keep' | 'remove' } | { action: 'replace'; logo: CompanyLogo };

const extensions = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
} as const;

export function createHostedBrand(client: WorkspaceClient) {
  return {
    async read(companyId: string, signal: AbortSignal): Promise<HostedBrand> {
      const id = z.uuid().parse(companyId);
      const { data, error } = await client
        .rpc('v2_read_pilot_company_brand', { p_company_id: id })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível carregar serviço, contato e logo.');
      const record = brandSchema.parse(data);
      if (record.companyId !== id) throw new Error('Cadastro de outra empresa recusado.');
      return record;
    },
    async update(record: HostedBrand, draft: HostedBrandDraft, change: LogoChange) {
      const companyId = z.uuid().parse(record.companyId);
      const expectedAt = z.iso.datetime({ offset: true }).parse(record.updatedAt);
      const { service, contact } = hostedBrandDraft.parse(draft);
      let path: string | null = null;
      if (change.action === 'replace') {
        const logo = logoSchema.parse(change.logo);
        const bytes = Uint8Array.from(atob(logo.dataUrl.split(',')[1]), (byte) =>
          byte.charCodeAt(0),
        );
        path = `${companyId}/brand/logo-${crypto.randomUUID()}.${extensions[logo.contentType]}`;
        const { error } = await client.storage.from('cali-workspace-private').upload(path, bytes, {
          contentType: logo.contentType,
          cacheControl: '0',
          upsert: false,
        });
        if (error) throw new Error('Não foi possível armazenar a logo.');
      }
      const { data, error } = await client.rpc('v2_update_pilot_company_brand', {
        p_company_id: companyId,
        p_expected_at: expectedAt,
        p_service: service || null,
        p_contact: { ...contact, birthday: contact.birthday || null },
        p_logo_action: change.action,
        p_logo_path: path,
      });
      if (error?.code === '40001') throw new Error('O cadastro mudou. Recarregue antes de salvar.');
      if (error || data !== companyId)
        throw new Error('Não foi possível confirmar serviço, contato e logo.');
    },
  };
}
