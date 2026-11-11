import { type catalog } from '../../api/shared/workspace/schemas';
import { Pages } from '../workspace/WorkspacePages';
import { panel, type Props } from '../workspace/workspace-presentation';
import { workspaceLabel } from '../workspace/workspace-labels';
import { formatServerInstant } from '../../lib/dates';

type AgendaData = ReturnType<typeof catalog.parse>;

function localDay(instant: string) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instant));
}

function dayLabel(instant: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'full',
  }).format(new Date(instant));
}

export function AgendaList({ data, search, update }: Props & { data: AgendaData }) {
  const sorted = data.entries
    .filter((entry) => entry.instant !== null || entry.day !== null)
    .slice()
    .sort((left, right) => {
      const leftDay = left.instant ? localDay(left.instant) : (left.day ?? '');
      const rightDay = right.instant ? localDay(right.instant) : (right.day ?? '');
      const dayOrder = leftDay.localeCompare(rightDay);
      if (dayOrder) return dayOrder;
      if (!left.instant || !right.instant) {
        if (!left.instant && !right.instant) return 0;
        return left.instant ? 1 : -1;
      }
      return Date.parse(left.instant) - Date.parse(right.instant);
    });
  const groups = sorted.reduce<Array<{ day: string; entries: typeof sorted }>>((result, entry) => {
    const day = entry.instant ? localDay(entry.instant) : (entry.day ?? '');
    const previous = result[result.length - 1];
    if (previous?.day === day) previous.entries.push(entry);
    else result.push({ day, entries: [entry] });
    return result;
  }, []);

  if (!groups.length) {
    return <p className={panel}>Nenhum evento ou aviso publicado neste mês.</p>;
  }

  return (
    <div className="tw:grid tw:gap-4" aria-label="Agenda do mês">
      <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
        {data.total} {data.total === 1 ? 'item' : 'itens'} no mês
      </p>
      {groups.map((group) => (
        <section
          key={group.day}
          className="tw:grid tw:gap-3"
          aria-label={dayLabel(`${group.day}T12:00:00-03:00`)}
        >
          <h2 className="tw:m-0 tw:text-section tw:font-semibold tw:text-brand">
            {dayLabel(`${group.day}T12:00:00-03:00`)}
          </h2>
          <ol className="tw:m-0 tw:grid tw:list-none tw:gap-0 tw:overflow-hidden tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-0">
            {group.entries.map((entry) => (
              <li
                key={entry.id}
                className="tw:flex tw:min-w-0 tw:gap-3 tw:border-b tw:border-border-default tw:p-4 tw:wrap-anywhere tw:last:border-b-0"
              >
                <span
                  aria-hidden="true"
                  className="tw:mt-1 tw:w-1 tw:shrink-0 tw:rounded-full tw:bg-brand"
                />
                <div className="tw:grid tw:min-w-0 tw:flex-1 tw:gap-2">
                  <div className="tw:flex tw:min-w-0 tw:flex-wrap tw:items-start tw:justify-between tw:gap-2">
                    <strong className="tw:min-w-0 tw:flex-1">{entry.title}</strong>
                    {entry.status && (
                      <span className="tw:rounded-full tw:border tw:border-border-default tw:bg-ivory tw:px-2 tw:py-1 tw:text-caption tw:text-brand">
                        {workspaceLabel(entry.status)}
                      </span>
                    )}
                  </div>
                  {entry.instant ? (
                    <time
                      dateTime={entry.instant}
                      className="tw:text-caption tw:font-semibold tw:text-muted-copy"
                    >
                      {formatServerInstant(entry.instant)}
                    </time>
                  ) : (
                    <span className="tw:text-caption tw:text-muted-copy">Dia inteiro</span>
                  )}
                  {entry.protocol && (
                    <span className="tw:text-caption tw:text-muted-copy">{entry.protocol}</span>
                  )}
                  {entry.summary && (
                    <p className="tw:m-0 tw:text-caption tw:whitespace-pre-line tw:text-muted-copy">
                      {entry.summary}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
      <Pages total={data.total} search={search} update={update} />
    </div>
  );
}
