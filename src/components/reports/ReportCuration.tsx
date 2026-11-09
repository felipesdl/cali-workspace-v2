import { TextArea } from '../ds/field/Controls';
import {
  reportCurationLimit,
  reportCurationSections,
  type ReportCuration,
} from '../../api/shared/workspace/report-curation';
import { Field } from '../ds/field/Field';
import { ActionForm } from '../workspace/ActionForm';
import {
  executiveMetricRows,
  type ReportMetrics,
  reportSourceRows,
  type ReportSourceCounts,
} from '../../api/shared/workspace/report-metrics';

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
              <TextArea
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
        <div key={label}>
          <dt className="tw:font-semibold">{label}</dt>
          <dd className="tw:wrap-anywhere tw:whitespace-pre-line">{sections[key]}</dd>
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

export function ReportSources({
  counts,
  title = 'Fontes do relatório',
}: {
  counts: ReportSourceCounts;
  title?: string;
}) {
  const rows = reportSourceRows(counts);
  if (rows.length === 0) return null;
  return (
    <details className="tw:mt-2">
      <summary className="tw:cursor-pointer">{title}</summary>
      <dl className="tw:grid tw:gap-2">
        {rows.map(({ label, value }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
