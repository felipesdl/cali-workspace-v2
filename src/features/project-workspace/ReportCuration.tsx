import {
  reportCurationLimit,
  reportCurationSections,
  type ReportCuration,
} from '../../api/modules/project-workspace/report-curation';
import { Field } from '../../components/ds/field/Field';
import { ActionForm } from './ActionForm';

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
