import { formatTerminationReason, teamTerminationCodes } from './termination';
import { z } from 'zod';
import { teamStatus, type ProfessionalRecord } from './schemas';

const required = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalText = z.string().trim().max(180).nullable();
const optionalDate = z.iso.date().nullable();
export const terminationInitiatives = {
  Employee: 'employee',
  Company: 'company',
  ContractEnd: 'contract_end',
  Other: 'other',
} as const;
export const noticeTypes = {
  Worked: 'worked',
  Indemnified: 'indemnified',
  Waived: 'waived',
  NotApplicable: 'not_applicable',
} as const;

export const professionalFieldsSchema = z.object({
  employee_code: required(1, 60),
  full_name: required(2, 180),
  job_title: required(1, 180),
  department: required(1, 180),
  admission_date: z.iso.date(),
  work_email: z.email().max(254).nullable(),
  work_phone: z.string().trim().max(40).nullable(),
  seniority: optionalText,
  team_area: optionalText,
  manager_code: z.string().trim().max(60).nullable(),
  is_leader: z.boolean(),
  employment_type: required(1, 60),
  weekly_hours: z.number().min(0).max(80).nullable(),
  work_model: optionalText,
  location: optionalText,
  status: z.enum(teamStatus),
  leave_reason: optionalText,
  leave_start_date: optionalDate,
  expected_return_date: optionalDate,
  termination_date: optionalDate,
  termination_initiative: z.enum(terminationInitiatives).nullable(),
  termination_reason: optionalText,
  notice_type: z.enum(noticeTypes).nullable(),
});
export const professionalPatchSchema = professionalFieldsSchema
  .partial()
  .required({ employee_code: true });
export type ProfessionalFields = z.infer<typeof professionalFieldsSchema>;
export type ProfessionalPatch = z.infer<typeof professionalPatchSchema>;

export const teamSaveRowSchema = z.object({
  fields: professionalPatchSchema,
  expectedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type TeamSaveRow = z.infer<typeof teamSaveRowSchema>;
export const teamSaveResult = z.object({
  ids: z.array(z.uuid()),
  added: z.number().int(),
  changed: z.number().int(),
});

export function writeMonthOptions(now = new Date()) {
  const current = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).format(now);
  const [year, month] = current.split('-').map(Number);
  const previous = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
  return [current, previous];
}

export function toProfessionalPatch(
  data: FormData,
  member: ProfessionalRecord | null,
): ProfessionalPatch {
  const record = Object.fromEntries(
    professionalFieldsSchema
      .keyof()
      .options.map((key) => {
        if (key === 'is_leader') return [key, data.has(key)];
        if (key === 'employee_code' && member) return [key, member.employee_code];
        const value = data.get(key);
        if (typeof value !== 'string') return [key, undefined];
        if (key === 'weekly_hours') return [key, value ? Number(value) : null];
        return [key, value.trim() || null];
      })
      .filter(([, value]) => value !== undefined),
  );
  const code = formTerminationCode(data.get('termination_code'));
  const linked = Object.entries(teamTerminationCodes).find(([value]) => value === code)?.[1];
  if (data.has('termination_code')) {
    record.termination_reason = formatTerminationReason(
      code,
      String(record.termination_reason ?? ''),
    );
    if (linked) record.termination_initiative = linked.initiative;
  }
  return professionalPatchSchema.parse(record);
}

function formTerminationCode(value: FormDataEntryValue | null) {
  return typeof value === 'string' && /^\d{2}$/.test(value) ? value : '';
}
