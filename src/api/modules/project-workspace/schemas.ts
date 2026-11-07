import { z } from 'zod';
import { reportCurationSchema } from './report-curation';
import { reportMetricsSchema } from './report-metrics';

const sectionSchema = z.enum(['deliverables', 'workstreams']);
const monthSchema = z.iso.date().refine((date) => date.endsWith('-01'));
export const workspaceSearch = z.object({
  companyId: z.uuid().optional().catch(undefined),
  project: z.uuid().optional().catch(undefined),
  record: z.uuid().optional().catch(undefined),
  section: sectionSchema.default('deliverables').catch('deliverables'),
  page: z.coerce.number().int().min(1).max(10000).default(1).catch(1),
  month: monthSchema.optional().catch(undefined),
});
export type WorkspaceSearch = z.infer<typeof workspaceSearch>;

const project = z.object({
  id: z.uuid(),
  name: z.string(),
  protocol: z.string().nullable(),
  planning_status: z.string(),
  execution_status: z.string(),
  roadmap_start_date: z.iso.date().nullable(),
  roadmap_end_date: z.iso.date().nullable(),
});
export const projectList = z.object({
  companyId: z.uuid(),
  total: z.number().int().nonnegative(),
  projects: z.array(project),
});
export const projectDetail = z.object({
  companyId: z.uuid(),
  project: project.extend({
    description: z.string().nullable(),
    updated_at: z.string().optional(),
  }),
  review: z
    .object({
      id: z.uuid().optional(),
      status: z.string(),
      number: z.number().int(),
      dueAt: z.string().nullable(),
      note: z.string().nullable().optional(),
      changes: z
        .object({
          targetType: z.enum(['project', 'workstream', 'deliverable']).optional(),
          targetId: z.uuid().optional(),
          targetLabel: z.string().optional(),
          actionLabel: z.string().optional(),
          requestedDate: z.iso.date().optional(),
          swapTargetLabel: z.string().optional(),
        })
        .optional(),
    })
    .nullable(),
  items: z.object({
    total: z.number().int().nonnegative(),
    rows: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        protocol: z.string().nullable(),
        status: z.string(),
        execution_status: z.string(),
        due_at: z.string().nullable(),
        updated_at: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        workstream_id: z.uuid().nullable().optional(),
        complexity: z.enum(['MC1', 'MC2', 'MC3']).nullable().optional(),
        sort_order: z.number().int().optional(),
      }),
    ),
  }),
});
const hourCapacityHistory = z.object({
  paused: z.boolean(),
  milestones: z.array(
    z.object({
      kind: z.enum(['m75', 'm100', 'excess', 'tolerance', 'review']),
      percent: z.number(),
      at: z.iso.datetime({ offset: true }),
      occurrence: z.number().int().positive().nullable(),
    }),
  ),
});
export type HourCapacityHistory = z.infer<typeof hourCapacityHistory>;

export const hours = z.discriminatedUnion('visible', [
  z.object({ companyId: z.uuid(), month: monthSchema, visible: z.literal(false) }),
  z.object({
    companyId: z.uuid(),
    month: monthSchema,
    visible: z.literal(true),
    total: z.number().int().nonnegative(),
    minutes: z.number().int(),
    capacityHistory: hourCapacityHistory.optional(),
    capacity: z
      .object({
        contractedMinutes: z.number().int().positive().nullable(),
        consumedMinutes: z.number().int(),
        remainingMinutes: z.number().int().nonnegative().nullable(),
        overMinutes: z.number().int().nonnegative().nullable(),
      })
      .optional(),
    entries: z.array(
      z.object({
        id: z.uuid(),
        work_date: z.iso.date(),
        description: z.string(),
        minutes: z.number().int(),
        category: z.string().optional(),
        internal_note: z.string().optional(),
        clientVisible: z.boolean().optional(),
        editVersion: z
          .string()
          .regex(/^[0-9a-f]{64}$/)
          .optional(),
      }),
    ),
  }),
]);

const catalogModuleSchema = z.enum([
  'calendar',
  'records',
  'documents',
  'notices',
  'reports',
  'fronts',
]);
export type CatalogModule = z.infer<typeof catalogModuleSchema>;
const frontMode = z.enum(['slot_included', 'slot_paid', 'addon', 'build_assisted']);
const frontTerms = z.object({
  scope: z.string().nullable(),
  mode: frontMode,
  endsOn: z.iso.date().nullable(),
});
export type FrontTerms = z.infer<typeof frontTerms>;
export const frontOption = z.object({
  code: z.string().min(1).max(100),
  title: z.string(),
  mode: frontMode,
});
export const frontOptions = z.object({ hasPlan: z.boolean(), options: z.array(frontOption) });
export const frontActivation = frontOption.omit({ title: true }).extend({
  scope: z.string().trim().max(240),
  startsOn: z.iso.date(),
  endsOn: z.iso.date().nullable(),
});
export type FrontActivation = z.infer<typeof frontActivation>;

export const catalog = z.object({
  companyId: z.uuid(),
  module: catalogModuleSchema,
  month: monthSchema.nullable(),
  total: z.number().int().nonnegative(),
  entries: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      protocol: z.string().nullable(),
      status: z.string().nullable(),
      instant: z.string().nullable(),
      day: z.iso.date().nullable(),
      summary: z.string().nullable(),
      acknowledgmentAvailable: z.boolean().optional(),
      noticeAcknowledged: z.boolean().nullable().optional(),
      noticeEditable: z.boolean().optional(),
      reportUpdatedAt: z.string().nullable().optional(),
      reportVersion: z.number().int().positive().nullable().optional(),
      reportCuration: reportCurationSchema.nullable().optional(),
      reportMetrics: reportMetricsSchema.nullable().catch(null).optional(),
      reportPdfReady: z.boolean().optional(),
      reportPreviouslyReleased: z.boolean().optional(),
      reportAcknowledged: z.boolean().optional(),
      frontTerms: frontTerms.nullable().optional(),
    }),
  ),
});

export type ProjectDetail = z.infer<typeof projectDetail>;
