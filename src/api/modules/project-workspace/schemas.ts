import { z } from 'zod';

const sectionSchema = z.enum(['deliverables', 'workstreams']);
const monthSchema = z.iso.date().refine((date) => date.endsWith('-01'));
export const workspaceSearch = z.object({
  companyId: z.uuid().optional().catch(undefined),
  project: z.uuid().optional().catch(undefined),
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
  project: project.extend({ description: z.string().nullable() }),
  review: z
    .object({ status: z.string(), number: z.number().int(), dueAt: z.string().nullable() })
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
      }),
    ),
  }),
});
export const hours = z.discriminatedUnion('visible', [
  z.object({ companyId: z.uuid(), month: monthSchema, visible: z.literal(false) }),
  z.object({
    companyId: z.uuid(),
    month: monthSchema,
    visible: z.literal(true),
    total: z.number().int().nonnegative(),
    minutes: z.number().int(),
    entries: z.array(
      z.object({
        id: z.uuid(),
        work_date: z.iso.date(),
        description: z.string(),
        minutes: z.number().int(),
        category: z.string().optional(),
        internal_note: z.string().optional(),
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
    }),
  ),
});
