import { z } from 'zod';
import { companyPlan, type CompanyDetails } from './schemas';

export const companyService = {
  Partner: 'CALI Partner',
  Full: 'CALI Full',
  BuildEssential: 'CALI Build Essencial',
  BuildComplete: 'CALI Build Completo',
  Advisory: 'Assessoria Estratégica Mensal',
  Mentoring: 'Mentoria para RH',
  Training: 'Treinamento',
  Structure: 'Projeto de Estruturação',
  Custom: 'Solução personalizada',
} as const;
export const companySegments = [
  'Tecnologia',
  'Serviços',
  'Serviços corporativos',
  'Indústria',
  'Varejo',
  'Saúde',
  'Educação',
  'Logística e transportes',
  'Construção e engenharia',
  'Financeiro',
  'Alimentação e hospitalidade',
] as const;
export const logoLimits = {
  inputBytes: 12 * 1024 * 1024,
  outputBytes: 700 * 1024,
  side: 1200,
} as const;
export const logoSchema = z
  .strictObject({
    sourceName: z.string().min(1),
    contentType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/avif']),
    dataUrl: z.string().max(Math.ceil(logoLimits.outputBytes / 3) * 4 + 64),
    bytes: z.number().int().positive().max(logoLimits.outputBytes),
    width: z.number().int().positive().max(logoLimits.side),
    height: z.number().int().positive().max(logoLimits.side),
  })
  .refine((value) => {
    const prefix = `data:${value.contentType};base64,`;
    if (!value.dataUrl.startsWith(prefix)) return false;
    const data = value.dataUrl.slice(prefix.length);
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data))
      return false;
    const padding = data.endsWith('==') ? 2 : Number(data.endsWith('='));
    return (data.length * 3) / 4 - padding === value.bytes;
  }, 'Logo preparada inválida. Selecione a imagem novamente.');
export type CompanyLogo = z.infer<typeof logoSchema>;

const optionalEmail = z.union([z.literal(''), z.email('Informe um e-mail comercial válido.')]);
export const registrationValuesSchema = z
  .strictObject({
    service: z.enum(companyService).nullable(),
    segment: z.string(),
    monthlyHours: z
      .number()
      .finite()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER)
      .nullable()
      .transform((value) => (value === 0 ? null : value)),
    addressStreet: z.string(),
    addressNumber: z.string(),
    neighborhood: z.string(),
    city: z.string(),
    state: z.string().regex(/^$|^[A-Z]{2}$/, 'Use a sigla do estado com duas letras.'),
    hasBranches: z.boolean(),
    branches: z.array(z.string().trim().min(1)),
    contactName: z.string(),
    contactJobTitle: z.string(),
    contactEmail: optionalEmail,
    contactPhone: z.string(),
    contactWhatsapp: z.string(),
    contactBirthday: z.iso.date().nullable(),
    logo: logoSchema.nullable(),
  })
  .transform((value) => ({ ...value, branches: value.hasBranches ? value.branches : [] }));
export const registrationSchema = z.strictObject({
  companyId: z.uuid(),
  revision: z.number().int().nonnegative(),
  values: registrationValuesSchema,
});
export const updateRegistrationSchema = z.strictObject({
  requestId: z.uuid(),
  companyId: z.uuid(),
  expectedRevision: z.number().int().nonnegative(),
  values: registrationValuesSchema,
});
export const registrationEventSchema = z
  .strictObject({
    id: z.uuid(),
    companyId: z.uuid(),
    previous: registrationSchema,
    current: registrationSchema,
    recordedBy: z.uuid(),
    recordedAt: z.iso.datetime({ offset: true }),
  })
  .refine(
    (event) =>
      event.previous.companyId === event.companyId &&
      event.current.companyId === event.companyId &&
      event.current.revision === event.previous.revision + 1,
    'Histórico cadastral inconsistente.',
  );
export type RegistrationValues = z.infer<typeof registrationValuesSchema>;
export type CompanyRegistrationRecord = z.infer<typeof registrationSchema>;
export type UpdateRegistration = z.infer<typeof updateRegistrationSchema>;
export type RegistrationEvent = z.infer<typeof registrationEventSchema>;

export function planForCompanyService(service: RegistrationValues['service']) {
  switch (service) {
    case companyService.Partner:
      return companyPlan.Partner;
    case companyService.Full:
      return companyPlan.Full;
    case companyService.BuildEssential:
      return companyPlan.BuildEssential;
    case companyService.BuildComplete:
      return companyPlan.BuildComplete;
    default:
      return null;
  }
}
export function emptyRegistration(company: CompanyDetails): CompanyRegistrationRecord {
  const servicesByPlan = {
    partner: companyService.Partner,
    full: companyService.Full,
    build: null,
    build_essential: companyService.BuildEssential,
    build_complete: companyService.BuildComplete,
  } satisfies Record<NonNullable<CompanyDetails['plan']>, RegistrationValues['service']>;
  return {
    companyId: company.id,
    revision: 0,
    values: {
      service: company.plan ? servicesByPlan[company.plan] : null,
      segment: '',
      monthlyHours: null,
      addressStreet: '',
      addressNumber: '',
      neighborhood: '',
      city: '',
      state: '',
      hasBranches: false,
      branches: [],
      contactName: '',
      contactJobTitle: '',
      contactEmail: '',
      contactPhone: '',
      contactWhatsapp: '',
      contactBirthday: null,
      logo: null,
    },
  };
}
