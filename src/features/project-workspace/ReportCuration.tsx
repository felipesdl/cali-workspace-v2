import {
  reportCurationLimit,
  reportCurationSections,
  type ReportCuration,
} from '../../api/modules/project-workspace/report-curation';
import { Field } from '../../components/ds/field/Field';
import { type z } from 'zod';
import { ActionForm } from './ActionForm';
import {
  executiveMetricRows,
  type ReportMetrics,
  type reportSourceCountsSchema,
} from '../../api/modules/project-workspace/report-metrics';

export function ReportCurationEditor({
  sections,
  save,
}: {
  sections: ReportCuration;
  save: (sections: ReportCuration) => Promise<string>;
}) {
  return (
    <ActionForm
      label="Salvar curadoria"
      submit={(fields) =>
        save({
          movements: String(fields.get('movements') ?? ''),
          decisions: String(fields.get('decisions') ?? ''),
          risks: String(fields.get('risks') ?? ''),
          nextSteps: String(fields.get('nextSteps') ?? ''),
        })
      }
    >
      {(prefix) => (
        <>
          <p>Estas seções acompanham a revisão liberada ao Cliente.</p>
          {reportCurationSections.map(({ key, label }) => (
            <Field key={key} id={prefix + key} label={label}>
              <textarea
                id={prefix + key}
                name={key}
                defaultValue={sections[key]}
                maxLength={reportCurationLimit}
                rows={3}
              />
            </Field>
          ))}
        </>
      )}
    </ActionForm>
  );
}

export function ReportCurationSections({ sections }: { sections: ReportCuration }) {
  const filled = reportCurationSections.filter(({ key }) => sections[key]);
  if (filled.length === 0) return null;
  return (
    <dl className="tw:mt-2 tw:grid tw:gap-2">
      {filled.map(({ key, label }) => (
        <div key={key}>
          <dt className="tw:font-semibold">{label}</dt>
          <dd className="tw:break-words tw:whitespace-pre-line">{sections[key]}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ReportIndicators({ metrics }: { metrics: ReportMetrics }) {
  return (
    <section className="tw:mt-2" aria-label="Indicadores da revisão">
      <h3 className="tw:font-semibold">Indicadores da revisão</h3>
      <dl className="tw:grid tw:gap-2">
        {executiveMetricRows(metrics).map(({ label, value }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

type ReportSourceCounts = z.infer<typeof reportSourceCountsSchema>;

const reportSourceLabels = [
  ['projects', 'Projetos no período'],
  ['tasksCreated', 'Tarefas criadas'],
  ['tasksCompleted', 'Tarefas concluídas'],
  ['events', 'Eventos no período'],
  ['documentsPublished', 'Documentos publicados'],
  ['comments', 'Comentários no período'],
] as const satisfies ReadonlyArray<readonly [keyof ReportSourceCounts, string]>;

export function ReportSources({ counts }: { counts: ReportSourceCounts }) {
  const rows = reportSourceLabels.filter(([key]) => counts[key] !== undefined);
  if (rows.length === 0) return null;
  return (
    <details className="tw:mt-2">
      <summary className="tw:cursor-pointer">Fontes do relatório</summary>
      <dl className="tw:grid tw:gap-2">
        {rows.map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{counts[key]}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
