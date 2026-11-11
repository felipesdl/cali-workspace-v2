import { Building2, CalendarDays } from 'lucide-react';
import { type Company } from '../../../../api/admin/companies/schemas';
import { Select } from '../../../../components/ds/field/Controls';
import { currentBrasiliaMonth } from '../../../../lib/dates';
import { formatOverviewMonth } from './overview-format';

// Composição de .ap-filters em app.cali@773c9d4: o label é a superfície do filtro.
const filterClass =
  'tw:box-border tw:flex tw:min-w-0 tw:max-w-full tw:items-center tw:gap-1.5 tw:rounded-media tw:border tw:border-[var(--workspace-chrome-border)] tw:bg-panel tw:px-2.5 tw:text-caption tw:text-copy';
const selectClass =
  'tw:min-h-9! tw:max-w-[190px] tw:flex-1 tw:appearance-auto! tw:border-0! tw:bg-transparent! tw:bg-none! tw:py-1! tw:ps-1.5! tw:pe-1! tw:text-[length:var(--workspace-text-control)]! tw:max-[850px]:min-h-10!';

function monthOptions(value: string) {
  const current = new Date(`${currentBrasiliaMonth()}T12:00:00Z`);
  const recent = Array.from({ length: 12 }, (_, index) =>
    new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - index, 1))
      .toISOString()
      .slice(0, 10),
  );
  return [...new Set([...recent, value])].sort().reverse();
}

export function OverviewFilters({
  companies,
  companyId,
  month,
  onCompany,
  onMonth,
}: {
  companies?: Company[];
  companyId?: string;
  month?: string;
  onCompany: (companyId: string | undefined) => void;
  onMonth: (month: string) => void;
}) {
  if (!companies?.length && !month) return null;
  return (
    <div className="tw:flex tw:min-w-0 tw:flex-wrap tw:items-center tw:gap-2.5">
      {Boolean(companies?.length) && (
        <label className={`${filterClass} tw:w-[190px]`}>
          <Building2 aria-hidden="true" size={14} className="tw:shrink-0" />
          <Select
            aria-label="Conta"
            value={companyId ?? ''}
            onChange={(event) => onCompany(event.currentTarget.value || undefined)}
            className={selectClass}
          >
            <option value="">Todas as contas</option>
            {companyId && !companies?.some((company) => company.id === companyId) && (
              <option value={companyId}>Conta indisponível</option>
            )}
            {companies?.map((company) => (
              <option key={company.id} value={company.id}>
                {company.displayName}
              </option>
            ))}
          </Select>
        </label>
      )}
      {month && (
        <>
          <label className={`${filterClass} tw:w-[168px]`}>
            <CalendarDays aria-hidden="true" size={14} className="tw:shrink-0" />
            <Select
              aria-label="Mês das horas"
              value={month}
              onChange={(event) => onMonth(event.currentTarget.value)}
              className={selectClass}
            >
              {monthOptions(month).map((value) => (
                <option key={value} value={value}>
                  {formatOverviewMonth(value)}
                </option>
              ))}
            </Select>
          </label>
          <p className="tw:m-0 tw:text-[length:var(--workspace-text-control)] tw:text-muted-copy tw:wide:ml-auto">
            O mês filtra as horas. Agenda e prazos cobrem os próximos 15 dias.
          </p>
        </>
      )}
    </div>
  );
}
