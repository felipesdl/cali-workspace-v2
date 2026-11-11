import { type catalog } from '../../api/shared/workspace/schemas';
import { Button } from '../ds/button/Button';
import { FeedbackState } from '../ds/feedback/FeedbackState';
import { Pages } from '../workspace/WorkspacePages';
import { recordStatusLabel } from '../workspace/workspace-labels';
import { formatCalendarDate, formatServerInstant } from '../../lib/dates';
import { panel, type Props } from '../workspace/workspace-presentation';

type CatalogData = ReturnType<typeof catalog.parse>;

export function RecordCatalogList({
  data,
  search,
  update,
  role,
  canOpenConversation,
}: Props & { data: CatalogData; role: 'admin' | 'client'; canOpenConversation: boolean }) {
  if (!data.entries.length) {
    return (
      <FeedbackState kind="empty">
        {role === 'admin'
          ? 'Nenhuma ocorrência nesta página.'
          : 'Você ainda não abriu uma ocorrência para sua empresa.'}
      </FeedbackState>
    );
  }

  return (
    <section className="tw:grid tw:min-w-0 tw:gap-3" aria-label="Ocorrências">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
        <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
          {data.total} {data.total === 1 ? 'ocorrência' : 'ocorrências'} · página {search.page}
        </p>
      </div>
      <ol className="tw:m-0 tw:grid tw:list-none tw:gap-3 tw:p-0">
        {data.entries.map((entry) => (
          <li
            key={entry.id}
            className={`${panel} tw:grid tw:min-w-0 tw:gap-3 tw:wrap-anywhere ${
              canOpenConversation
                ? 'tw:focus-within:border-gold tw:hover:border-gold tw:motion-safe:transition-colors'
                : ''
            }`}
          >
            <div className="tw:flex tw:min-w-0 tw:flex-wrap tw:items-start tw:justify-between tw:gap-3">
              <div className="tw:grid tw:min-w-0 tw:gap-1">
                {entry.protocol && (
                  <span className="tw:text-caption tw:font-semibold tw:tracking-wide tw:text-muted-copy">
                    {entry.protocol}
                  </span>
                )}
                <h2 className="tw:m-0 tw:text-body tw:font-bold tw:text-brand">{entry.title}</h2>
              </div>
              {entry.status && (
                <span className="tw:rounded-full tw:border tw:border-border-default tw:bg-ivory tw:px-3 tw:py-1 tw:text-caption tw:font-semibold tw:text-brand">
                  {recordStatusLabel(entry.status)}
                </span>
              )}
            </div>
            {(entry.instant || entry.day) && (
              <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
                {entry.instant
                  ? formatServerInstant(entry.instant)
                  : formatCalendarDate(entry.day ?? '')}
              </p>
            )}
            {entry.summary && <p className="tw:m-0 tw:whitespace-pre-line">{entry.summary}</p>}
            {canOpenConversation && (
              <Button
                variant="secondary"
                className="tw:justify-self-start"
                onClick={() => update({ record: entry.id })}
              >
                Abrir conversa
              </Button>
            )}
          </li>
        ))}
      </ol>
      <Pages total={data.total} search={search} update={update} />
    </section>
  );
}
