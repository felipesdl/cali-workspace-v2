import { z } from 'zod';

export const ownProfile = z.object({
  id: z.uuid(),
  full_name: z.string().nullable(),
  job_title: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
});
export type OwnProfile = z.infer<typeof ownProfile>;

export const ownProfileFields = [
  { name: 'full_name', label: 'Nome', autoComplete: 'name', maxLength: 200, type: 'text' },
  {
    name: 'job_title',
    label: 'Cargo',
    autoComplete: 'organization-title',
    maxLength: 160,
    type: 'text',
  },
  { name: 'phone', label: 'Telefone', autoComplete: 'tel', maxLength: 40, type: 'tel' },
  { name: 'whatsapp', label: 'WhatsApp', autoComplete: 'off', maxLength: 40, type: 'tel' },
] as const;

const [name, job, phone, whatsapp] = ownProfileFields;
export const ownProfilePatch = z.strictObject({
  full_name: z.string().min(1, 'Informe seu nome.').max(name.maxLength).optional(),
  job_title: z.string().max(job.maxLength).nullable().optional(),
  phone: z.string().max(phone.maxLength).nullable().optional(),
  whatsapp: z.string().max(whatsapp.maxLength).nullable().optional(),
});
export type OwnProfilePatch = z.infer<typeof ownProfilePatch>;
export type OwnProfileValues = Pick<OwnProfile, (typeof ownProfileFields)[number]['name']>;

export const ownProfileUpdate = z.discriminatedUnion('status', [
  z.object({ status: z.literal('saved'), profile: ownProfile }),
  z.object({ status: z.literal('conflict') }),
]);
