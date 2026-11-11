import { type catalog } from '../../api/shared/workspace/schemas';
import { Button } from '../ds/button/Button';
import { Dialog } from '../ds/dialog/Dialog';
import { NoticeCover } from './NoticeCover';
import { NoticeInteractions } from './NoticeInteractions';
import { NoticeItemAction } from '../workspace/CatalogActions';
import { Pages } from '../workspace/WorkspacePages';
import { FeedbackState } from '../ds/feedback/FeedbackState';
import { Panel } from '../ds/panel/Panel';
import { formatCalendarDate, formatServerInstant } from '../../lib/dates';
import { workspaceLabel } from '../workspace/workspace-labels';
import { type Props } from '../workspace/workspace-presentation';

type CatalogData = ReturnType<typeof catalog.parse>;

export function NoticeCatalogList({
  company,
  actor,
  data,
  search,
  update,
  role,
}: Props & { data: CatalogData; company: string; actor?: string; role: 'admin' | 'client' }) {
  const selected = search.aviso;
  const missing = selected && !data.entries.some((item) => item.id === selected);
  const missingNotice = missing && (
    <Dialog title="Comunicado indisponível" onDismiss={() => update({ aviso: undefined })}>
      <p className="tw:m-0">Este comunicado não está na página atual do mural.</p>
    </Dialog>
  );
  if (!data.entries.length) {
    return (
      <>
        {missingNotice}
        <FeedbackState kind="empty">
          {role === 'admin'
            ? 'Não há comunicados nesta página. Use a publicação acima para criar um aviso.'
            : 'Quando a CALI publicar um aviso para sua empresa, ele aparecerá aqui.'}
        </FeedbackState>
      </>
    );
  }

  return (
    <section aria-label="Quadro de avisos" className="tw:grid tw:min-w-0 tw:gap-3">
      {missingNotice}
      <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
        {data.total} {data.total === 1 ? 'comunicado' : 'comunicados'}
      </p>
      <div className="tw:grid tw:gap-4 tw:wide:grid-cols-2">
        {data.entries.map((item) => (
          <Panel
            key={item.id}
            className="tw:grid tw:min-w-0 tw:content-start tw:gap-3 tw:overflow-hidden tw:p-0!"
          >
            {item.status === 'published' && item.noticeCoverEnabled && item.noticeHasCover && (
              <div className="tw:order-1 tw:max-h-64 tw:overflow-hidden tw:bg-ivory">
                <NoticeCover
                  company={company}
                  actor={actor}
                  notice={item.id}
                  version={item.noticeCoverVersion ?? null}
                  hasCover={Boolean(item.noticeHasCover)}
                  editable={false}
                />
              </div>
            )}
            <div className="tw:order-2 tw:grid tw:min-w-0 tw:gap-3 tw:p-4 tw:wide:p-5">
              <header className="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
                <span
                  aria-hidden="true"
                  className="tw:grid tw:size-9 tw:shrink-0 tw:place-items-center tw:rounded-control tw:bg-ivory tw:font-bold tw:text-brand"
                >
                  C
                </span>
                <span className="tw:grid tw:min-w-0 tw:flex-1 tw:gap-1">
                  <strong className="tw:text-caption tw:text-brand">CALI · Assessoria</strong>
                  <small className="tw:text-muted-copy">
                    {[
                      item.protocol,
                      item.status && workspaceLabel(item.status),
                      item.day
                        ? formatCalendarDate(item.day)
                        : item.instant && formatServerInstant(item.instant),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </span>
              </header>
              <h2 className="tw:m-0 tw:text-section tw:font-bold tw:wrap-anywhere tw:text-brand">
                {item.title}
              </h2>
              {item.summary && (
                <p className="tw:m-0 tw:line-clamp-3 tw:whitespace-pre-line tw:text-muted-copy">
                  {item.summary}
                </p>
              )}
              <div>
                <Button
                  variant="secondary"
                  aria-haspopup="dialog"
                  onClick={() => update({ aviso: item.id })}
                >
                  Abrir comunicado
                </Button>
              </div>
            </div>
            {selected === item.id && (
              <Dialog title={item.title} onDismiss={() => update({ aviso: undefined })}>
                {item.status === 'published' && item.noticeCoverEnabled && (
                  <NoticeCover
                    company={company}
                    actor={actor}
                    notice={item.id}
                    version={item.noticeCoverVersion ?? null}
                    hasCover={Boolean(item.noticeHasCover)}
                    editable={role === 'admin' && Boolean(item.noticeEditable)}
                  />
                )}
                {item.summary && <p className="tw:mt-0 tw:whitespace-pre-line">{item.summary}</p>}
                <div className="tw:grid tw:gap-3">
                  <NoticeItemAction
                    company={company}
                    actor={actor}
                    id={item.id}
                    status={item.status}
                    editable={role === 'admin' ? item.noticeEditable : undefined}
                    acknowledged={
                      role === 'client' ? (item.noticeAcknowledged ?? undefined) : undefined
                    }
                  />
                  {item.status === 'published' && (
                    <NoticeInteractions company={company} actor={actor} notice={item.id} />
                  )}
                </div>
              </Dialog>
            )}
          </Panel>
        ))}
      </div>
      <Pages total={data.total} search={search} update={update} />
    </section>
  );
}
