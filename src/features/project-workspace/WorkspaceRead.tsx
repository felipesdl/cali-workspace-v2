import { CommercialDraftEditor } from './CommercialDraftEditor';
import { SatisfactionResults } from './SatisfactionResults';
import { AuditResults, CommercialResults } from './AdminReadResults';
import { DeliveryPdf, DocumentLibrary } from './DocumentLibrary';
import {
  CreateReportDraft,
  FormAdministration,
  NoticeItemAction,
  PublishNotice,
  ReportDraftActions,
  ReportPublicationActions,
} from './CatalogActions';
import { AgendaActions } from './AgendaActions';
import { OpenRecord, RecordConversation } from './RecordActions';
import { PrivacyActions, ReportAcknowledgment, ReportReadiness } from './ReportPrivacyActions';
import { HourActions } from './HourActions';
import { CreateProject, DeliveryActions, LifecycleActions, ProjectActions } from './ProjectActions';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getRouteApi,
  useLocation,
  useNavigate,
  useRouteContext,
  useSearch,
} from '@tanstack/react-router';
import { useWorkspaceSession } from '../../api/modules/access/hooks/useWorkspaceSession';
import { useCompaniesQuery } from '../../api/modules/companies/hooks/useCompaniesQuery';
import { isPilotCompany } from '../../api/modules/companies/onboarding';
import {
  workspaceSearch,
  type CatalogModule,
  type WorkspaceSearch,
} from '../../api/modules/project-workspace/schemas';
import { Button } from '../../components/ds/button/Button';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { Field } from '../../components/ds/field/Field';
import { formatCalendarDate, formatServerInstant } from '../../lib/dates';
import { phase4CatalogFromPath } from '../../app/phase4-navigation';
import { ClientModulePending } from '../client-account/ClientModulePending';

const adminProjects = getRouteApi('/admin/projetos');
const clientProjects = getRouteApi('/cliente/entregaveis');
const adminHours = getRouteApi('/admin/horas');
const adminPrivacy = getRouteApi('/admin/privacidade');
const adminForms = getRouteApi('/admin/formularios');
const adminAudit = getRouteApi('/admin/auditoria');
const adminSatisfaction = getRouteApi('/admin/satisfacao');
const adminCommercial = getRouteApi('/admin/propostas');
const clientHours = getRouteApi('/cliente/horas');
const panel = 'tw:min-w-0 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4';
const labels: Readonly<Record<string, string>> = {
  draft: 'Rascunho',
  planned: 'Planejado',
  client_review: 'Em revisão do Cliente',
  adjustment_requested: 'Ajuste solicitado',
  approved: 'Aprovado',
  accepted: 'Aceito',
  rejected: 'Recusado',
  active: 'Ativo',
  rebriefing: 'Revisão de escopo',
  closed: 'Encerrado',
  pending: 'Pendente',
  not_started: 'Não iniciado',
  in_progress: 'Em execução',
  standby: 'Em espera',
  internal_review: 'Em revisão interna',
  cancelled: 'Cancelado',
  normal: 'Em andamento',
  paused: 'Pausado',
  suspended: 'Suspenso',
  published: 'Publicado',
  sent: 'Disponibilizado',
  archived: 'Arquivado',
  meeting: 'Reunião',
  ended: 'Encerrada',
};
const label = (status: string) => labels[status] ?? status;

type Props = { search: WorkspaceSearch; update: (change: Partial<WorkspaceSearch>) => void };

function useScope(search: WorkspaceSearch) {
  const { projectWorkspace, session } = useRouteContext({ from: '__root__' });
  const state = useWorkspaceSession();
  const profile =
    state.phase === 'resolved' && state.access.status === 'ready' ? state.access.profile : null;
  const admin = profile?.role === 'admin';
  const requested = admin ? search.companyId : (profile?.company_id ?? undefined);
  return {
    service: projectWorkspace,
    actor: profile?.id,
    companyId: profile?.active && isPilotCompany(requested) ? requested : undefined,
    admin,
    connected: session !== null,
  };
}

function CompanySelect({ search, update }: Props) {
  const companies = useCompaniesQuery({ q: '', status: 'all' });
  if (companies.isPending)
    return <FeedbackState kind="loading">Carregando empresas…</FeedbackState>;
  if (companies.isError)
    return (
      <FeedbackState kind="error" onRetry={() => void companies.refetch()}>
        Não foi possível carregar as empresas.
      </FeedbackState>
    );
  return (
    <Field id="operations-company" label="Empresa de homologação">
      <select
        id="operations-company"
        value={search.companyId ?? ''}
        onChange={(event) =>
          update({
            companyId: event.currentTarget.value || undefined,
            project: undefined,
            record: undefined,
            page: 1,
          })
        }
      >
        <option value="">Selecione a empresa</option>
        {companies.data
          .filter((company) => isPilotCompany(company.id))
          .map((company) => (
            <option key={company.id} value={company.id}>
              {company.displayName}
            </option>
          ))}
      </select>
    </Field>
  );
}

function Pages({ total, search, update }: Props & { total: number }) {
  const last = Math.max(1, Math.ceil(total / 25));
  if (last === 1 && search.page === 1) return null;
  return (
    <nav aria-label="Paginação" className="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
      <Button
        variant="secondary"
        disabled={search.page <= 1}
        onClick={() => update({ page: search.page - 1 })}
      >
        Anterior
      </Button>
      <span>
        Página {search.page} de {last}
      </span>
      <Button
        variant="secondary"
        disabled={search.page >= last}
        onClick={() => update({ page: search.page + 1 })}
      >
        Próxima
      </Button>
    </nav>
  );
}

function Projects({ search, update }: Props) {
  const { service, actor, companyId, admin, connected } = useScope(search);
  const { documentOperations } = useRouteContext({ from: '__root__' });
  const { page, section, project } = search;
  const list = useQuery({
    queryKey: ['projects', actor, companyId, page],
    queryFn:
      service && companyId && !project
        ? ({ signal }) => service.list(companyId, page, signal)
        : skipToken,
  });
  const detail = useQuery({
    queryKey: ['project', actor, companyId, project, section, page],
    queryFn:
      service && companyId && project
        ? ({ signal }) => service.detail(companyId, project, section, page, signal)
        : skipToken,
  });
  if (!service) return connected && !admin ? <ClientModulePending /> : null;
  const result = project ? detail : list;
  return (
    <div className="tw:grid tw:gap-4">
      {admin && <CompanySelect search={search} update={update} />}
      {!companyId ? (
        <FeedbackState kind="empty">
          {admin ? 'Selecione uma empresa.' : 'Projetos indisponíveis para esta empresa.'}
        </FeedbackState>
      ) : result.isPending ? (
        <FeedbackState kind="loading">Carregando projetos…</FeedbackState>
      ) : result.isError ? (
        <FeedbackState kind="error" onRetry={() => void result.refetch()}>
          Não foi possível consultar os projetos.
        </FeedbackState>
      ) : project ? (
        <>
          <div>
            <Button variant="secondary" onClick={() => update({ project: undefined, page: 1 })}>
              Voltar aos projetos
            </Button>
          </div>
          {detail.data ? (
            <section className={panel}>
              <h2 className="tw:font-semibold">{detail.data.project.name}</h2>
              <p>{detail.data.project.description}</p>
              <p>
                {label(detail.data.project.planning_status)} ·{' '}
                {label(detail.data.project.execution_status)}
              </p>
              {(detail.data.project.roadmap_start_date || detail.data.project.roadmap_end_date) && (
                <p>
                  Início {formatCalendarDate(detail.data.project.roadmap_start_date ?? '')} · Fim{' '}
                  {formatCalendarDate(detail.data.project.roadmap_end_date ?? '')}
                </p>
              )}
              {detail.data.review && (
                <p>
                  Revisão {detail.data.review.number} · {label(detail.data.review.status)}
                  {detail.data.review.dueAt && (
                    <> · Prazo {formatServerInstant(detail.data.review.dueAt)} (Brasília)</>
                  )}
                </p>
              )}
              <ProjectActions
                key={project}
                company={companyId}
                actor={actor}
                project={project}
                planning={detail.data.project.planning_status}
                review={detail.data.review}
                admin={admin}
              />
              {admin && ['active', 'rebriefing'].includes(detail.data.project.planning_status) && (
                <LifecycleActions
                  company={companyId}
                  actor={actor}
                  project={project}
                  execution={detail.data.project.execution_status}
                />
              )}
              <div className="tw:my-4 tw:flex tw:gap-2">
                <Button
                  aria-pressed={section === 'deliverables'}
                  variant="secondary"
                  onClick={() => update({ section: 'deliverables', page: 1 })}
                >
                  Entregáveis
                </Button>
                <Button
                  aria-pressed={section === 'workstreams'}
                  variant="secondary"
                  onClick={() => update({ section: 'workstreams', page: 1 })}
                >
                  Frentes do projeto
                </Button>
              </div>
              {detail.data.items.rows.length ? (
                <ul className="tw:grid tw:gap-3">
                  {detail.data.items.rows.map((row) => (
                    <li key={row.id}>
                      <strong>{row.name}</strong>
                      <p>
                        {label(row.status)} · {label(row.execution_status)}
                        {row.due_at ? ` · Prazo ${formatServerInstant(row.due_at)}` : ''}
                      </p>
                      {section === 'deliverables' &&
                        documentOperations &&
                        (admin || row.status === 'client_review' || row.status === 'approved') && (
                          <DeliveryPdf
                            company={companyId}
                            actor={actor}
                            operations={documentOperations}
                            project={project}
                            delivery={row.id}
                            status={row.status}
                            admin={admin}
                            canEdit={
                              row.execution_status === 'normal' &&
                              detail.data?.project.execution_status === 'normal' &&
                              ['active', 'rebriefing'].includes(detail.data.project.planning_status)
                            }
                          />
                        )}
                      {section === 'deliverables' &&
                        row.updated_at &&
                        row.execution_status === 'normal' &&
                        detail.data?.project.execution_status === 'normal' &&
                        ['active', 'rebriefing'].includes(detail.data.project.planning_status) && (
                          <DeliveryActions
                            company={companyId}
                            actor={actor}
                            project={project}
                            delivery={row.id}
                            expected={row.updated_at}
                            status={row.status}
                            admin={admin}
                          />
                        )}
                    </li>
                  ))}
                </ul>
              ) : (
                <FeedbackState kind="empty">Nenhum item nesta página.</FeedbackState>
              )}
              <Pages total={detail.data.items.total} search={search} update={update} />
            </section>
          ) : (
            <FeedbackState kind="empty">Projeto indisponível.</FeedbackState>
          )}
        </>
      ) : list.data ? (
        <>
          {admin && (
            <CreateProject
              key={companyId}
              company={companyId}
              actor={actor}
              open={(created) => update({ project: created, page: 1 })}
            />
          )}
          {list.data.projects.length ? (
            <ul className="tw:grid tw:gap-3">
              {list.data.projects.map((row) => (
                <li key={row.id} className={panel}>
                  <p>
                    <strong>{row.name}</strong>
                    {row.protocol ? ` · ${row.protocol}` : ''}
                  </p>
                  <p>
                    {label(row.planning_status)} · {label(row.execution_status)}
                  </p>
                  <Button variant="secondary" onClick={() => update({ project: row.id, page: 1 })}>
                    Abrir projeto
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <FeedbackState kind="empty">Nenhum projeto nesta página.</FeedbackState>
          )}
          <Pages total={list.data.total} search={search} update={update} />
        </>
      ) : null}
    </div>
  );
}

function Minutes({ value }: { value: number }) {
  const absolute = Math.abs(value);
  return (
    <>
      {value < 0 ? '−' : ''}
      {Math.floor(absolute / 60)} h {absolute % 60} min
    </>
  );
}

function currentMonth() {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
  return `${formatter.format(new Date())}-01`;
}

function MonthSelect({ month, update }: { month: string; update: Props['update'] }) {
  return (
    <Field id="phase4-month" label="Mês de referência">
      <input
        id="phase4-month"
        type="month"
        value={month.slice(0, 7)}
        onChange={(event) => {
          const value = event.currentTarget.value;
          if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) update({ month: `${value}-01`, page: 1 });
        }}
      />
    </Field>
  );
}

function Hours({ search, update }: Props) {
  const { service, actor, companyId, admin, connected } = useScope(search);
  const month = search.month ?? currentMonth();
  const result = useQuery({
    queryKey: ['hours', actor, companyId, month, search.page],
    queryFn:
      service && companyId
        ? ({ signal }) => service.hours(companyId, month, search.page, signal)
        : skipToken,
  });
  if (!service) return connected && !admin ? <ClientModulePending /> : null;
  return (
    <div className="tw:grid tw:gap-4">
      {admin && <CompanySelect search={search} update={update} />}
      <MonthSelect month={month} update={update} />
      {admin && companyId && <HourActions key={companyId} company={companyId} actor={actor} />}
      {!companyId ? (
        <FeedbackState kind="empty">
          {admin ? 'Selecione uma empresa.' : 'Horas indisponíveis para esta empresa.'}
        </FeedbackState>
      ) : result.isPending ? (
        <FeedbackState kind="loading">Carregando extrato…</FeedbackState>
      ) : result.isError ? (
        <FeedbackState kind="error" onRetry={() => void result.refetch()}>
          Não foi possível consultar o extrato.
        </FeedbackState>
      ) : result.data.visible ? (
        <section className={panel}>
          <h2 className="tw:font-semibold">Extrato de atuação</h2>
          <p>
            Total dos lançamentos exibíveis no mês: <Minutes value={result.data.minutes} />
          </p>
          {result.data.entries.length ? (
            <ul className="tw:my-4 tw:grid tw:gap-3">
              {result.data.entries.map((entry) => (
                <li key={entry.id}>
                  <strong>{entry.description}</strong>
                  <p>
                    {formatCalendarDate(entry.work_date)} · <Minutes value={entry.minutes} />
                    {entry.category && ` · ${entry.category}`}
                  </p>
                  {admin && entry.internal_note && <p>Nota interna: {entry.internal_note}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <FeedbackState kind="empty">Nenhum lançamento nesta página.</FeedbackState>
          )}
          <Pages total={result.data.total} search={search} update={update} />
        </section>
      ) : (
        <FeedbackState kind="empty">
          A consulta de horas está indisponível neste período.
        </FeedbackState>
      )}
    </div>
  );
}

export function AdminProjectsPage() {
  const search = adminProjects.useSearch();
  const navigate = adminProjects.useNavigate();
  return (
    <Projects
      search={search}
      update={(change) => void navigate({ search: { ...search, ...change } })}
    />
  );
}

export function ClientProjectsPage() {
  const search = clientProjects.useSearch();
  const navigate = clientProjects.useNavigate();
  return (
    <Projects
      search={search}
      update={(change) => void navigate({ search: { ...search, ...change, companyId: undefined } })}
    />
  );
}

export function AdminHoursPage() {
  const search = adminHours.useSearch();
  const navigate = adminHours.useNavigate();
  return (
    <Hours
      search={search}
      update={(change) => void navigate({ search: { ...search, ...change } })}
    />
  );
}

export function ClientHoursPage() {
  const search = clientHours.useSearch();
  const navigate = clientHours.useNavigate();
  return (
    <Hours
      search={search}
      update={(change) => void navigate({ search: { ...search, ...change, companyId: undefined } })}
    />
  );
}

function Catalog({ search, update, module }: Props & { module: CatalogModule }) {
  const { service, actor, companyId, admin, connected } = useScope(search);
  const { domainOperations, documentOperations } = useRouteContext({ from: '__root__' });
  const record = module === 'records' && domainOperations ? search.record : undefined;
  const month = module === 'calendar' ? (search.month ?? currentMonth()) : null;
  const result = useQuery({
    queryKey: ['phase4-catalog', actor, companyId, module, month, search.page],
    queryFn:
      service && companyId && !record
        ? ({ signal }) => service.catalog(companyId, module, month, search.page, signal)
        : skipToken,
  });
  if (!service) return connected && !admin ? <ClientModulePending /> : null;
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

      {module === 'notices' && admin && companyId && (
        <PublishNotice key={companyId} company={companyId} actor={actor} />
      )}
      {module === 'reports' && admin && companyId && (
        <CreateReportDraft key={companyId} company={companyId} actor={actor} />
      )}
      {module === 'reports' && admin && companyId && (
        <ReportReadiness key={companyId} company={companyId} actor={actor} />
      )}
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
      ) : (
        <>
          {module === 'documents' && documentOperations && (
            <h2 className="tw:text-section">Acervo anterior</h2>
          )}
          {result.data.entries.length ? (
            <ul className="tw:grid tw:gap-3">
              {result.data.entries.map((item) => (
                <li key={item.id} className={panel}>
                  <strong>{item.title}</strong>
                  <p>
                    {[
                      item.protocol,
                      item.status && label(item.status),
                      item.day
                        ? formatCalendarDate(item.day)
                        : item.instant && formatServerInstant(item.instant),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {module === 'records' && domainOperations && (
                    <Button variant="secondary" onClick={() => update({ record: item.id })}>
                      Abrir conversa
                    </Button>
                  )}
                  {module === 'reports' &&
                    !admin &&
                    !item.reportVersion &&
                    item.acknowledgmentAvailable && (
                      <ReportAcknowledgment company={companyId} report={item.id} />
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
                  {module === 'reports' && admin && item.reportUpdatedAt && (
                    <ReportDraftActions
                      company={companyId}
                      actor={actor}
                      id={item.id}
                      status={item.status}
                      expected={item.reportUpdatedAt}
                      summary={item.summary}
                      released={item.status === 'published' && Boolean(item.reportVersion)}
                    />
                  )}
                  {module === 'reports' && item.reportVersion && (
                    <ReportPublicationActions
                      company={companyId}
                      actor={actor}
                      id={item.id}
                      version={item.reportVersion}
                      pdfReady={Boolean(item.reportPdfReady)}
                      published={item.status === 'published'}
                      admin={admin}
                      previouslyReleased={Boolean(item.reportPreviouslyReleased)}
                      acknowledgmentAvailable={Boolean(item.acknowledgmentAvailable)}
                    />
                  )}
                  {item.summary && (
                    <p className="tw:mt-2 tw:break-words tw:whitespace-pre-line">{item.summary}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <FeedbackState kind="empty">Nenhum registro nesta página.</FeedbackState>
          )}
          <Pages total={result.data.total} search={search} update={update} />
        </>
      )}
    </div>
  );
}

export function Phase4CatalogPage() {
  const path = useLocation({ select: (location) => location.pathname });
  const view = phase4CatalogFromPath(path);
  const search = workspaceSearch.parse(useSearch({ strict: false }));
  const navigate = useNavigate();
  if (!view) return null;
  return (
    <Catalog
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

export function AdminPrivacyPage() {
  const search = adminPrivacy.useSearch();
  const navigate = adminPrivacy.useNavigate();
  const { companyId, actor, admin } = useScope(search);
  const { domainOperations } = useRouteContext({ from: '__root__' });
  if (!admin || !domainOperations) return null;
  return (
    <div className="tw:grid tw:gap-4">
      <CompanySelect
        search={search}
        update={(change) => void navigate({ search: { ...search, ...change } })}
      />
      {companyId ? (
        <PrivacyActions key={companyId} company={companyId} actor={actor} admin />
      ) : (
        <p>Selecione uma empresa.</p>
      )}
    </div>
  );
}

export function AdminFormsPage() {
  const search = adminForms.useSearch();
  const navigate = adminForms.useNavigate();
  const { companyId, actor, admin } = useScope(search);
  const { domainOperations } = useRouteContext({ from: '__root__' });
  if (!admin || !domainOperations) return null;
  return (
    <div className="tw:grid tw:gap-4">
      <CompanySelect
        search={search}
        update={(change) => void navigate({ search: { ...search, ...change } })}
      />
      {companyId ? (
        <FormAdministration key={companyId} company={companyId} actor={actor} />
      ) : (
        <p>Selecione uma empresa.</p>
      )}
    </div>
  );
}

function AdminAudit({ search, update }: Props) {
  const { adminRead } = useRouteContext({ from: '__root__' });
  const { companyId, actor, admin } = useScope(search);
  const month = search.month ?? null;
  const result = useQuery({
    queryKey: ['phase4-audit', actor, companyId, month, search.page],
    queryFn:
      admin && adminRead && companyId
        ? ({ signal }) => adminRead.audit(companyId, month, search.page, signal)
        : skipToken,
  });
  if (!admin || !adminRead) return null;
  return (
    <div className="tw:grid tw:gap-4">
      <CompanySelect search={search} update={update} />
      <Field id="audit-month" label="Mês da auditoria">
        <input
          id="audit-month"
          type="month"
          value={month?.slice(0, 7) ?? ''}
          onChange={(event) =>
            update({
              month: event.currentTarget.value ? `${event.currentTarget.value}-01` : undefined,
              page: 1,
            })
          }
        />
      </Field>
      {!companyId ? (
        <p>Selecione uma empresa.</p>
      ) : result.isPending ? (
        <FeedbackState kind="loading">Carregando eventos…</FeedbackState>
      ) : result.isError ? (
        <FeedbackState kind="error" onRetry={() => void result.refetch()}>
          Não foi possível consultar a auditoria.
        </FeedbackState>
      ) : (
        <>
          {result.data.entries.length ? (
            <AuditResults entries={result.data.entries} />
          ) : (
            <FeedbackState kind="empty">Nenhum evento nesta página.</FeedbackState>
          )}
          <Pages total={result.data.total} search={search} update={update} />
        </>
      )}
    </div>
  );
}

export function AdminAuditPage() {
  const search = adminAudit.useSearch();
  const navigate = adminAudit.useNavigate();
  return (
    <AdminAudit
      search={search}
      update={(change) => void navigate({ search: { ...search, ...change } })}
    />
  );
}

function AdminCommercial({ search, update }: Props) {
  const { adminRead, domainOperations } = useRouteContext({ from: '__root__' });
  const { companyId, actor, admin } = useScope(search);
  const result = useQuery({
    queryKey: ['phase4-commercial', actor, companyId, search.page],
    queryFn:
      admin && adminRead && companyId
        ? ({ signal }) => adminRead.commercial(companyId, search.page, signal)
        : skipToken,
  });
  if (!admin || !adminRead) return null;
  return (
    <div className="tw:grid tw:gap-4">
      <CompanySelect search={search} update={update} />
      {!companyId ? (
        <p>Selecione uma empresa.</p>
      ) : result.isPending ? (
        <FeedbackState kind="loading">Carregando propostas…</FeedbackState>
      ) : result.isError ? (
        <FeedbackState kind="error" onRetry={() => void result.refetch()}>
          Não foi possível consultar as propostas.
        </FeedbackState>
      ) : (
        <>
          {result.data.entries.length ? (
            <CommercialResults
              entries={result.data.entries}
              editor={
                domainOperations
                  ? (proposal) => (
                      <CommercialDraftEditor
                        company={companyId}
                        actor={actor}
                        proposal={proposal}
                        service={adminRead}
                      />
                    )
                  : undefined
              }
            />
          ) : (
            <FeedbackState kind="empty">
              Nenhuma proposta ou oportunidade vinculada a esta empresa nesta página.
            </FeedbackState>
          )}
          <Pages total={result.data.total} search={search} update={update} />
        </>
      )}
    </div>
  );
}

export function AdminCommercialPage() {
  const search = adminCommercial.useSearch();
  const navigate = adminCommercial.useNavigate();
  return (
    <AdminCommercial
      search={search}
      update={(change) => void navigate({ search: { ...search, ...change } })}
    />
  );
}

function AdminSatisfaction({ search, update }: Props) {
  const { adminRead, domainOperations } = useRouteContext({ from: '__root__' });
  const { companyId, actor, admin } = useScope(search);
  const cache = useQueryClient();
  const key = ['phase4-satisfaction', actor, companyId];
  const result = useQuery({
    queryKey: [...key, search.page],
    queryFn:
      admin && adminRead && companyId
        ? ({ signal }) => adminRead.satisfaction(companyId, search.page, signal)
        : skipToken,
  });
  if (!admin || !adminRead) return null;
  const service = adminRead;
  return (
    <div className="tw:grid tw:gap-4">
      <CompanySelect search={search} update={update} />
      {!companyId ? (
        <p>Selecione uma empresa.</p>
      ) : result.isPending ? (
        <FeedbackState kind="loading">Carregando avaliações…</FeedbackState>
      ) : result.isError ? (
        <FeedbackState kind="error" onRetry={() => void result.refetch()}>
          Não foi possível consultar as avaliações.
        </FeedbackState>
      ) : (
        <>
          {result.data.entries.length ? (
            <SatisfactionResults
              entries={result.data.entries}
              save={
                domainOperations
                  ? async (entry, theme, note) => {
                      try {
                        return await service.saveFollowup(companyId, entry, theme, note);
                      } finally {
                        await Promise.all([
                          cache.invalidateQueries({ queryKey: key }),
                          cache.invalidateQueries({ queryKey: ['phase4-audit', actor, companyId] }),
                        ]);
                      }
                    }
                  : undefined
              }
            />
          ) : (
            <FeedbackState kind="empty">Nenhuma avaliação de 1 a 3 nesta página.</FeedbackState>
          )}
          <Pages total={result.data.total} search={search} update={update} />
        </>
      )}
    </div>
  );
}

export function AdminSatisfactionPage() {
  const search = adminSatisfaction.useSearch();
  const navigate = adminSatisfaction.useNavigate();
  return (
    <AdminSatisfaction
      search={search}
      update={(change) => void navigate({ search: { ...search, ...change } })}
    />
  );
}
