import { z } from 'zod';

export const reportCurationLimit = 2000;
const section = z.string().trim().max(reportCurationLimit);

export const reportCurationSchema = z.object({
  movements: section,
  decisions: section,
  risks: section,
  nextSteps: section,
});

export type ReportCuration = z.infer<typeof reportCurationSchema>;

export const reportCurationSections = [
  { key: 'movements', label: 'Movimentos' },
  { key: 'decisions', label: 'Decisões' },
  { key: 'risks', label: 'Riscos' },
  { key: 'nextSteps', label: 'Próximos passos' },
] as const satisfies readonly { key: keyof ReportCuration; label: string }[];
