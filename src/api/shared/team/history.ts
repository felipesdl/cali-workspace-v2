import { z } from 'zod';
import { teamStatus } from './schemas';

export const teamChange = {
  Admission: 'admission',
  Promotion: 'promotion',
  Transfer: 'transfer',
  Manager: 'manager_change',
  Contract: 'contract_change',
  Leave: 'leave',
  Return: 'return',
  Termination: 'termination',
  Correction: 'correction',
  Archived: 'archived',
  Reactivated: 'reactivated',
} as const;

export const teamHistory = z.object({
  total: z.number().int().nonnegative(),
  confirmed: z.boolean(),
  snapshotCount: z.number().int().nonnegative(),
  events: z.array(
    z.object({
      id: z.uuid(),
      member_id: z.uuid(),
      full_name: z.string(),
      created_at: z.iso.datetime({ offset: true }),
      kind: z.enum(teamChange),
    }),
  ),
  snapshots: z.array(
    z.object({
      member_id: z.uuid(),
      full_name: z.string(),
      department: z.string(),
      manager_code: z.string().nullable(),
      job_title: z.string(),
      status: z.enum(teamStatus),
      admission_date: z.iso.date(),
      termination_date: z.iso.date().nullable(),
    }),
  ),
});

export const teamStructure = z.array(
  z.object({
    department: z.string(),
    manager_code: z.string().nullable(),
    manager_name: z.string().nullable(),
    total: z.number().int().positive(),
  }),
);
