import { z } from 'zod';

export const teamStatus = {
  Active: 'active',
  Leave: 'leave',
  Terminated: 'terminated',
} as const;
export const teamFilters = { All: 'all', Archived: 'archived', ...teamStatus } as const;
export const teamPageSize = 25;
export const teamViews = {
  Directory: 'directory',
  Structure: 'structure',
  History: 'history',
  Monthly: 'monthly',
} as const;

export const teamSearchSchema = z.object({
  companyId: z.uuid().optional().catch(undefined),
  member: z.uuid().optional().catch(undefined),
  q: z.string().trim().max(120).catch(''),
  status: z.enum(teamFilters).catch(teamFilters.All),
  view: z.enum(teamViews).catch(teamViews.Directory),
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional()
    .catch(undefined),
  page: z.number().int().min(1).max(10000).catch(1),
});
export type TeamSearch = z.infer<typeof teamSearchSchema>;

const professionalIdentity = z.object({
  id: z.uuid(),
  employee_code: z.string(),
  full_name: z.string(),
  job_title: z.string(),
  department: z.string(),
  manager_code: z.string().nullable(),
  admission_date: z.iso.date(),
  status: z.enum(teamStatus),
  archived_at: z.iso.datetime({ offset: true }).nullable(),
});

const text = z.string().nullable();
const date = z.iso.date().nullable();
export const professionalRecord = professionalIdentity.extend({
  company_id: z.uuid(),
  work_email: text,
  work_phone: text,
  seniority: text,
  team_area: text,
  is_leader: z.boolean(),
  employment_type: z.string(),
  weekly_hours: z.number().nullable(),
  work_model: text,
  location: text,
  leave_reason: text,
  leave_start_date: date,
  expected_return_date: date,
  termination_date: date,
  termination_initiative: text,
  termination_reason: text,
  notice_type: text,
  updated_at: z.iso.datetime({ offset: true }),
});
export type ProfessionalRecord = z.infer<typeof professionalRecord>;
export const teamDirectory = z.object({
  companyId: z.uuid(),
  companyName: z.string(),
  total: z.number().int().nonnegative(),
  members: z.array(professionalIdentity.extend({ manager_name: text })).max(teamPageSize),
});
export type TeamDirectory = z.infer<typeof teamDirectory>;
