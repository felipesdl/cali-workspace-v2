import { z } from 'zod';

export const discStyle = z.enum(['D', 'I', 'S', 'C']);
const nullableText = z.string().nullable();
const timestamp = z.iso.datetime({ offset: true }).nullable();

export const discSignerSchema = z.object({
  full_name: z.string(),
  job_title: nullableText,
  avatar_url: nullableText,
  avatar_position_x: z.number().nullable(),
  avatar_position_y: z.number().nullable(),
  avatar_zoom: z.number().nullable(),
  signature_mode: nullableText,
  signature_url: nullableText,
  signature_style: nullableText,
});

export const discCampaignSchema = z.object({
  id: z.uuid(),
  created_at: z.iso.datetime({ offset: true }),
  created_by: z.uuid(),
  company_id: z.uuid().nullable(),
  title: z.string(),
  organization: z.string(),
  purpose: z.string(),
  status: z.enum(['open', 'closed']),
  revision: z.number().int().nonnegative(),
  goal: nullableText,
  note: nullableText,
  moment: nullableText,
  sector: nullableText,
  focal_name: nullableText,
  focal_email: nullableText,
  approved_at: timestamp,
  released_at: timestamp,
  protocol: nullableText,
  signer: discSignerSchema.nullable(),
});

export const discInviteSchema = z.object({
  id: z.uuid(),
  person_name: z.string(),
  email: z.email(),
  state: z.enum([
    'created',
    'queued',
    'sent',
    'opened',
    'started',
    'declined',
    'expired',
    'completed',
  ]),
  deadline_at: timestamp,
  last_block: z.number().int().nonnegative(),
  token: z.uuid(),
});

const scoreValue = z.strictObject({ raw: z.number(), pct: z.number() });
const scoreByStyle = z.record(discStyle, scoreValue);
const adaptationByStyle = z.record(discStyle, z.number());
export const discEvaluationSchema = z.object({
  id: z.uuid(),
  person_name: z.string(),
  email: z.email(),
  job_title: nullableText,
  primary_style: discStyle,
  secondary_style: discStyle,
  mixed: z.boolean(),
  scores: z.strictObject({
    natural: scoreByStyle,
    pressure: scoreByStyle,
    natural6: scoreByStyle,
    adaptation: adaptationByStyle,
  }),
  protocol: z.string(),
  created_at: z.iso.datetime({ offset: true }),
});

const discCountsByStyleSchema = z.record(discStyle, z.number().int().nonnegative());
const discBandsByStyleSchema = z.record(
  discStyle,
  z.strictObject({
    low: z.number().int().nonnegative(),
    mid: z.number().int().nonnegative(),
    high: z.number().int().nonnegative(),
  }),
);
export const discManagementQuantitativeSchema = z.strictObject({
  secondary: discCountsByStyleSchema,
  mixed: z.number().int().nonnegative(),
  bands: discBandsByStyleSchema,
  pressure: z.strictObject({
    stable: z.number().int().nonnegative(),
    one: z.number().int().nonnegative(),
    many: z.number().int().nonnegative(),
    up: discCountsByStyleSchema,
    down: discCountsByStyleSchema,
  }),
});

export const discManagementSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  organization: z.string(),
  goal: nullableText,
  note: nullableText,
  moment: nullableText,
  sector: nullableText,
  mode: z.enum(['unavailable', 'qualitative', 'quantitative']),
  sample_size: z.number().int().nonnegative().nullable(),
  distribution: z.record(discStyle, z.number().int().nonnegative()).nullable(),
  quantitative: discManagementQuantitativeSchema.nullable(),
  qualitative: z.strictObject({ dominant: z.string(), pressure: z.string() }),
  approved_at: timestamp,
  released_at: timestamp,
  protocol: nullableText,
  signer: discSignerSchema.nullable(),
  revision: z.number().int().nonnegative(),
});

export const discJobSchema = z.object({
  id: z.uuid(),
  kind: z.string(),
  state: z.enum(['pending', 'processing', 'sent', 'failed']),
  campaign_id: z.uuid(),
  created_at: z.iso.datetime({ offset: true }),
  error: nullableText,
});

export const discHistorySchema = z.object({
  id: z.uuid(),
  kind: z.string(),
  revision: z.number().int().nonnegative(),
  created_at: z.iso.datetime({ offset: true }),
  reason: nullableText,
});

export const discAdminSnapshotSchema = z.strictObject({
  campaigns: z.array(discCampaignSchema),
  selected: z
    .strictObject({
      campaign: discCampaignSchema,
      invites: z.array(discInviteSchema),
      evaluations: z.array(discEvaluationSchema),
      management: discManagementSchema,
      jobs: z.array(discJobSchema),
      history: z.array(discHistorySchema),
    })
    .nullable(),
});

export const discClientSnapshotSchema = z.strictObject({ reports: z.array(discManagementSchema) });

export const discPublicProjectionSchema = z.strictObject({
  state: z.enum([
    'open',
    'closed',
    'created',
    'queued',
    'sent',
    'opened',
    'started',
    'declined',
    'expired',
    'completed',
    'missing',
  ]),
  title: nullableText,
  organization: nullableText,
  person_name: nullableText,
  deadline_at: timestamp,
  last_block: z.number().int().nonnegative().nullable(),
});

const campaignFields = z.strictObject({
  title: z.string().trim().min(1).max(200),
  companyId: z.uuid().nullable(),
  organization: z.string().trim().min(1).max(200),
  purpose: z.string().trim().min(1).max(2000),
  focalName: z.string().trim().min(1).max(200),
  focalEmail: z.email(),
  goal: z.string().trim().min(1).max(2000),
});
const inviteFields = z.strictObject({ name: z.string().trim().min(2).max(200), email: z.email() });
const inviteQueueFields = z.strictObject({ inviteId: z.uuid() });
const managementFields = z.strictObject({
  goal: z.string().trim().max(2000),
  note: z.string().trim().max(5000),
  moment: z.string().trim().max(1000),
  sector: z.string().trim().max(200),
});
const reasonFields = z.strictObject({ reason: z.string().trim().max(1000).optional() });
const managerPdfFields = z.strictObject({
  name: z.string().trim().min(2).max(200),
  email: z.email(),
});

export const discCommandSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('create'), fields: campaignFields }),
  z.strictObject({ kind: z.literal('invite'), fields: inviteFields }),
  z.strictObject({ kind: z.literal('queue'), fields: inviteQueueFields }),
  z.strictObject({ kind: z.literal('edit'), fields: managementFields }),
  z.strictObject({ kind: z.literal('approve'), fields: z.strictObject({}) }),
  z.strictObject({ kind: z.literal('release'), fields: z.strictObject({}) }),
  z.strictObject({
    kind: z.literal('reopen'),
    fields: z.strictObject({ reason: z.string().trim().min(3).max(1000) }),
  }),
  z.strictObject({ kind: z.literal('close'), fields: reasonFields }),
  z.strictObject({ kind: z.literal('schedule'), fields: reasonFields }),
  z.strictObject({ kind: z.literal('manager_pdf'), fields: managerPdfFields }),
]);

export const discCommandResultSchema = z.strictObject({
  id: z.uuid(),
  revision: z.number().int().nonnegative(),
});
export const discProcessJobsResultSchema = z.strictObject({
  processed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});
const answerSchema = z
  .strictObject({
    b: z.number().int().min(1).max(18),
    mais: discStyle,
    menos: discStyle,
  })
  .refine(
    (answer) => answer.mais !== answer.menos,
    'Mais e Menos precisam ser estilos diferentes.',
  );

const publicAnswersSchema = z
  .strictObject({
    natural: z.array(answerSchema).length(18),
    pressure: z.array(answerSchema).length(6),
  })
  .superRefine((answers, context) => {
    const naturalBlocks = answers.natural.map(({ b }) => b);
    if (
      new Set(naturalBlocks).size !== 18 ||
      naturalBlocks.some((block, index) => block !== index + 1)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['natural'],
        message: 'A chave natural precisa conter os blocos de 1 a 18.',
      });
    }
    const pressureBlocks = answers.pressure.map(({ b }) => b);
    if (
      new Set(pressureBlocks).size !== 6 ||
      pressureBlocks.some((block, index) => block !== [2, 5, 8, 11, 14, 17][index])
    ) {
      context.addIssue({
        code: 'custom',
        path: ['pressure'],
        message: 'A chave de pressão precisa conter os blocos previstos.',
      });
    }
  });

export const discPublicCommandSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('open'), fields: z.strictObject({}) }),
  z.strictObject({
    kind: z.literal('progress'),
    fields: z.strictObject({ block: z.number().int().min(0).max(24) }),
  }),
  z.strictObject({
    kind: z.literal('decline'),
    fields: z.strictObject({ reason: z.string().trim().max(1000).optional() }),
  }),
  z.strictObject({
    kind: z.literal('submit'),
    fields: z.strictObject({
      requestId: z.uuid(),
      jobTitle: z.string().trim().max(200),
      consent: z.literal(true),
      answers: publicAnswersSchema,
    }),
  }),
]);

export type DiscStyle = z.infer<typeof discStyle>;
export type DiscCampaign = z.infer<typeof discCampaignSchema>;
export type DiscInvite = z.infer<typeof discInviteSchema>;
export type DiscEvaluation = z.infer<typeof discEvaluationSchema>;
export type DiscManagement = z.infer<typeof discManagementSchema>;
export type DiscJob = z.infer<typeof discJobSchema>;
export type DiscHistory = z.infer<typeof discHistorySchema>;
export type DiscAdminSnapshot = z.infer<typeof discAdminSnapshotSchema>;
export type DiscClientSnapshot = z.infer<typeof discClientSnapshotSchema>;
export type DiscPublicProjection = z.infer<typeof discPublicProjectionSchema>;
export type DiscCommand = z.infer<typeof discCommandSchema>;
export type DiscPublicCommand = z.infer<typeof discPublicCommandSchema>;

type DiscCommandKind = DiscCommand['kind'];
type DiscCommandMetadata = { campaignId: string | null; expected: number | null };
export type DiscCommandDraft = {
  [Kind in DiscCommandKind]: Extract<DiscCommand, { kind: Kind }> & DiscCommandMetadata;
}[DiscCommandKind];
export type DiscCommandInput = {
  [Kind in DiscCommandKind]: Extract<DiscCommand, { kind: Kind }> & {
    campaignId: string | null;
    expected: number | null;
    requestId: string;
  };
}[DiscCommandKind];

export const DISC_PILOT_COMPANY_IDS = [
  '9c5ab148-78b8-4410-9338-58c44222a5db',
  '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76',
] as const;
