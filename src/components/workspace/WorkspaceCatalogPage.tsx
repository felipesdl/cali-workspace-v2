import { MonthSelect } from './WorkspaceMonthSelect';
import { type ReactNode } from 'react';
import { type z } from 'zod';
import { recordStatusLabel, workspaceLabel as label } from './workspace-labels';
import {
  ActivateContractedFront,
  ContractedFrontTerms,
  EndContractedFront,
} from './ContractedFrontTerms';
import { DocumentLibrary } from '../documents/DocumentLibrary';
import { NoticeItemAction, PublishNotice } from './CatalogActions';
import { AgendaActions } from '../agenda/AgendaActions';
import { NoticeInteractions } from '../notices/NoticeInteractions';
import { NoticeCover } from '../notices/NoticeCover';
import { OpenRecord, RecordConversation } from '../records/RecordActions';
import { skipToken, useQuery } from '@tanstack/react-query';
import { Link, useMatch, useNavigate, useRouteContext } from '@tanstack/react-router';
import { useProjectWorkspaceScope } from './useProjectWorkspaceScope';
import {
  workspaceSearch,
  type CatalogModule,
  type catalog,
} from '../../api/shared/workspace/schemas';
import { Button } from '../ds/button/Button';
import { FeedbackState } from '../ds/feedback/FeedbackState';
import { currentBrasiliaMonth, formatCalendarDate, formatServerInstant } from '../../lib/dates';
import { phase4CatalogFromPath } from '../../app/phase4-navigation';
import { ClientModulePending } from './ClientModulePending';
import { CompanySelect } from './WorkspaceCompanySelect';
import { Pages } from './WorkspacePages';
import { panel } from './workspace-presentation';
import { type Props } from './workspace-presentation';

type CatalogViews = {
  renderCompanyActions?: (scope: { company: string; actor?: string }) => ReactNode;
  renderResults?: (
    scope: Props & { company: string; actor?: string; data: z.infer<typeof catalog> },
  ) => ReactNode;
};

function Catalog({
  search,
  update,
  module,
  renderCompanyActions,
  renderResults,
}: Props & CatalogViews & { module: CatalogModule }) {
  const { service, actor, companyId, admin } = useProjectWorkspaceScope(search);
  const { domainOperations, documentOperations } = useRouteContext({ from: '__root__' });
  const statusLabel = module === 'records' ? recordStatusLabel : label;
  const record = module === 'records' && domainOperations ? search.record : undefined;
  const month = module === 'calendar' ? (search.month ?? currentBrasiliaMonth()) : null;
  const result = useQuery({
    queryKey: ['phase4-catalog', actor, companyId, module, month, search.page],
    queryFn:
      service && companyId && !record
        ? ({ signal }) => service.catalog(companyId, module, month, search.page, signal)
        : skipToken,
  });
  if (!service) return admin ? null : <ClientModulePending />;
  return (
    <div className="tw:grid tw:gap-4">
      {admin && <CompanySelect search={search} update={update} />}
      {module === 'documents' && companyId && documentOperations && (
        <DocumentLibrary
          key={companyId}
          company={companyId}
          actor={actor}
          operations={documentOperations}
          admin={admin}
        />
      )}
      {month && <MonthSelect month={month} update={update} />}
      {module === 'calendar' && companyId && (
        <AgendaActions key={companyId} company={companyId} actor={actor} admin={admin} />
      )}
      {module === 'fronts' && !admin && companyId && domainOperations && (
        <section className={panel} aria-label="Ajuda com o escopo">
          <p>
            Para conversar com a CALI sobre o escopo contratado, solicite uma reunião na Agenda.
          </p>
          <Link
            className="tw:text-brand tw:underline tw:focus-visible:outline-2 tw:focus-visible:outline-offset-3 tw:focus-visible:outline-focus"
            to="/cliente/cronograma"
            search={workspaceSearch.parse({})}
          >
            Solicitar conversa com a CALI
          </Link>
        </section>
      )}
      {module === 'fronts' && admin && companyId && (
        <ActivateContractedFront key={companyId} company={companyId} actor={actor} />
      )}

      {module === 'notices' && admin && companyId && (
        <PublishNotice key={companyId} company={companyId} actor={actor} />
      )}
      {companyId && renderCompanyActions?.({ company: companyId, actor })}
      {module === 'records' && companyId && !record && (
        <OpenRecord
          key={companyId}
          company={companyId}
          actor={actor}
          admin={admin}
          select={(id) => update({ record: id })}
        />
      )}
      {!companyId ? (
        <FeedbackState kind="empty">
          {admin ? 'Selecione uma empresa.' : 'Consulta indisponível para esta empresa.'}
        </FeedbackState>
      ) : record ? (
        <RecordConversation
          key={record}
          company={companyId}
          actor={actor}
          admin={admin}
          record={record}
          back={() => update({ record: undefined })}
        />
      ) : result.isPending ? (
        <FeedbackState kind="loading">Carregando informações…</FeedbackState>
      ) : result.isError ? (
        <FeedbackState kind="error" onRetry={() => void result.refetch()}>
          Não foi possível carregar as informações.
        </FeedbackState>
      ) : renderResults ? (
        renderResults({ company: companyId, actor, data: result.data, search, update })
      ) : (
        <>
          {module === 'documents' && documentOperations && (
            <h2 className="tw:text-section">Acervo anterior</h2>
          )}
          {result.data.entries.length ? (
            <ul className="tw:m-0 tw:grid tw:list-none tw:gap-3 tw:p-0">
              {result.data.entries.map((item) => (
                <li key={item.id} className={`${panel} tw:grid tw:gap-3 tw:wrap-anywhere`}>
                  <strong>{item.title}</strong>
                  {(item.protocol || item.status || item.day || item.instant) && (
                    <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
                      {[
                        item.protocol,
                        item.status && statusLabel(item.status),
                        item.day
                          ? formatCalendarDate(item.day)
                          : item.instant && formatServerInstant(item.instant),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                  {module === 'records' && domainOperations && (
                    <Button
                      variant="secondary"
                      className="tw:justify-self-start"
                      onClick={() => update({ record: item.id })}
                    >
                      Abrir conversa
                    </Button>
                  )}
                  {module === 'notices' && (
                    <NoticeItemAction
                      company={companyId}
                      actor={actor}
                      id={item.id}
                      status={item.status}
                      editable={item.noticeEditable}
                      acknowledged={item.noticeAcknowledged}
                    />
                  )}
                  {item.summary && <p className="tw:m-0 tw:whitespace-pre-line">{item.summary}</p>}
                  {item.frontTerms && <ContractedFrontTerms terms={item.frontTerms} />}
                  {item.frontTerms && admin && item.status === 'active' && (
                    <EndContractedFront company={companyId} actor={actor} id={item.id} />
                  )}
                  {module === 'notices' &&
                    item.status === 'published' &&
                    item.noticeCoverEnabled && (
                      <NoticeCover
                        company={companyId}
                        actor={actor}
                        notice={item.id}
                        version={item.noticeCoverVersion ?? null}
                        hasCover={Boolean(item.noticeHasCover)}
                        editable={Boolean(item.noticeEditable)}
                      />
                    )}
                  {module === 'notices' && item.status === 'published' && (
                    <NoticeInteractions company={companyId} actor={actor} notice={item.id} />
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <FeedbackState kind="empty">
              {module === 'fronts'
                ? 'Nenhuma frente contratada nesta página.'
                : 'Nenhum registro nesta página.'}
            </FeedbackState>
          )}
          <Pages total={result.data.total} search={search} update={update} />
        </>
      )}
    </div>
  );
}

export function WorkspaceCatalogPage({
  module,
  ...views
}: { module: CatalogModule } & CatalogViews) {
  const match = useMatch({ strict: false });
  const path = match.pathname;
  const view = phase4CatalogFromPath(path);
  const search = workspaceSearch.parse(match.search);
  const navigate = useNavigate();
  if (!view || view.module !== module) return null;
  return (
    <Catalog
      {...views}
      module={view.module}
      search={search}
      update={(change) =>
        void navigate({
          to: path.startsWith('/admin/') ? view.admin : view.client,
          search: { ...search, ...change },
        })
      }
    />
  );
}
