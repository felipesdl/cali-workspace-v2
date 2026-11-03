import { type AdministrationValues } from '../../api/modules/companies/administration-schemas';
import { administrationGroups } from './administration-fields';
import { formatAdministrationValue } from './administration-presentation';

export function AdministrationSummary({ values }: { values: AdministrationValues }) {
  return (
    <div className="tw:grid tw:gap-3">
      {administrationGroups.map((group) => (
        <details
          key={group.title}
          className="tw:rounded-control tw:border tw:border-border-default tw:p-3"
        >
          <summary className="tw:cursor-pointer tw:font-semibold tw:text-brand">
            {group.title}
          </summary>
          <dl className="tw:mt-4 tw:grid tw:grid-cols-2 tw:gap-4 tw:mobile:grid-cols-1 tw:[&_dd]:m-0 tw:[&_dd]:wrap-anywhere tw:[&_dd]:whitespace-pre-wrap tw:[&_dt]:text-caption tw:[&_dt]:text-muted-copy">
            {group.fields.map((field) => (
              <div key={field.name}>
                <dt>{field.label}</dt>
                <dd>{formatAdministrationValue(field, values)}</dd>
              </div>
            ))}
          </dl>
        </details>
      ))}
    </div>
  );
}
