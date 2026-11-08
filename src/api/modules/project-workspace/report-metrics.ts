import { z } from 'zod';

const count = z.number().int().nonnegative();
export const reportMetricsSchema = z.object({
  hours: z.object({ contractedHours: z.number().nonnegative(), consumedMinutes: count }),
  deliverables: z.object({ approvedCount: count, createdCount: count }),
  feedback: z.object({ count, average: z.number().min(0).max(5).nullable() }).optional(),
});
export type ReportMetrics = z.infer<typeof reportMetricsSchema>;

export const reportSourceCountsSchema = z.object({
  projects: count.optional(),
  tasksCreated: count.optional(),
  tasksCompleted: count.optional(),
  events: count.optional(),
  documentsPublished: count.optional(),
  comments: count.optional(),
});

const brNumber = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export function executiveMetricRows({ hours, deliverables, feedback }: ReportMetrics) {
  const rows = [
    { label: 'Horas contratadas', value: brNumber.format(hours.contractedHours) + ' h' },
    { label: 'Horas registradas', value: brNumber.format(hours.consumedMinutes / 60) + ' h' },
    {
      label: 'Entregáveis',
      value: `${deliverables.createdCount} criados · ${deliverables.approvedCount} aprovados`,
    },
  ];
  if (feedback && feedback.count >= 2 && feedback.average !== null)
    rows.push({
      label: 'Avaliação média',
      value: `${brNumber.format(feedback.average)}/5 · ${feedback.count} avaliações`,
    });
  return rows;
}

export type ReportSourceCounts = z.infer<typeof reportSourceCountsSchema>;

const reportSourceLabels = [
  ['projects', 'Projetos no período'],
  ['tasksCreated', 'Tarefas criadas'],
  ['tasksCompleted', 'Tarefas concluídas'],
  ['events', 'Eventos no período'],
  ['documentsPublished', 'Documentos publicados'],
  ['comments', 'Comentários no período'],
] as const satisfies ReadonlyArray<readonly [keyof ReportSourceCounts, string]>;

export function reportSourceRows(counts: ReportSourceCounts) {
  return reportSourceLabels.flatMap(([key, label]) => {
    const value = counts[key];
    return value === undefined ? [] : [{ label, value }];
  });
}
