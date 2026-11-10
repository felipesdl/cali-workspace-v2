import { useEffect, useRef } from 'react';
import { ProjectJournalPanel } from './ProjectJournalPanel';
import { ProjectRoadmap } from './ProjectRoadmap';
import { ProjectOverview } from './ProjectOverview';
import { ProjectDeliverableList } from './ProjectDeliverableList';
import { workspaceLabel as label } from '../workspace/workspace-labels';
import { DeliveryPdf } from '../documents/DocumentLibrary';
import { HourLink } from '../hours/HourLink';
import { EditProject, EditPlanItem, ScheduleItemRequest } from './ProjectPlanning';
import { CreateProject, DeliveryActions, LifecycleActions, ProjectActions } from './ProjectActions';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { useProjectWorkspaceScope } from '../workspace/useProjectWorkspaceScope';
import { Button } from '../ds/button/Button';
import { FeedbackState } from '../ds/feedback/FeedbackState';
import { formatServerInstant } from '../../lib/dates';
import { ClientModulePending } from '../workspace/ClientModulePending';
import { CompanySelect } from '../workspace/WorkspaceCompanySelect';
import { Pages } from '../workspace/WorkspacePages';
import { panel } from '../workspace/workspace-presentation';
import { type Props } from '../workspace/workspace-presentation';

const projectSectionButton =
  'tw:rounded-none tw:border-0 tw:border-b-2 tw:border-transparent tw:bg-transparent tw:px-2 tw:aria-pressed:border-brand tw:aria-pressed:font-semibold';

export function Projects({ search, update }: Props) {
  const { service, actor, companyId, admin } = useProjectWorkspaceScope(search);
  const { documentOperations, projectOperations } = useRouteContext({ from: '__root__' });
  const { page, section, project, projectView } = search;
  const readSection = projectView === 'roadmap' ? 'roadmap' : section;
  const list = useQuery({
    queryKey: ['projects', actor, companyId, page],
    queryFn:
      service && companyId && !project
        ? ({ signal }) => service.list(companyId, page, signal)
        : skipToken,
  });
  const detail = useQuery({
    queryKey: ['project', actor, companyId, project, readSection, page],
    queryFn:
      service && companyId && project
        ? ({ signal }) => service.detail(companyId, project, readSection, page, signal)
        : skipToken,
  });
  const projectData = detail.data;
  const result = project ? detail : list;
  const focusTarget = useRef<HTMLElement>(null);
  const focusAfterNavigation = useRef(false);
  const isSettled = result.isSuccess || result.isError;
  useEffect(() => {
    if (!isSettled || !focusAfterNavigation.current) return;
    focusAfterNavigation.current = false;
    if (document.activeElement === document.body) focusTarget.current?.focus();
  }, [isSettled, page, project, projectView, section]);

  const selectView: Props['update'] = (change) => {
    const next = { ...search, ...change };
    focusAfterNavigation.current =
      next.project !== project ||
      next.projectView !== projectView ||
      next.section !== section ||
      next.page !== page;
    update(change);
  };
  if (!service) return admin ? null : <ClientModulePending />;
  return (
    <section
      ref={focusTarget}
      tabIndex={-1}
      aria-label={project ? 'Detalhes do projeto' : 'Lista de projetos'}
      className="tw:grid tw:min-w-0 tw:gap-4"
    >
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
            <Button
              variant="secondary"
              onClick={() => selectView({ project: undefined, projectView: undefined, page: 1 })}
            >
              Voltar aos projetos
            </Button>
          </div>
          {projectData ? (
            <section className="tw:grid tw:min-w-0 tw:gap-4">
              <nav
                aria-label="Gestão do projeto"
                className="tw:flex tw:flex-wrap tw:gap-x-4 tw:border-b tw:border-border-default"
              >
                <Button
                  aria-pressed={projectView === 'roadmap'}
                  variant="secondary"
                  className={projectSectionButton}
                  onClick={() => selectView({ projectView: 'roadmap', page: 1 })}
                >
                  Cronograma
                </Button>
                <Button
                  aria-pressed={!projectView && section === 'deliverables'}
                  variant="secondary"
                  className={projectSectionButton}
                  onClick={() =>
                    selectView({ projectView: undefined, section: 'deliverables', page: 1 })
                  }
                >
                  Entregáveis
                </Button>
                <Button
                  aria-pressed={!projectView && section === 'workstreams'}
                  variant="secondary"
                  className={projectSectionButton}
                  onClick={() =>
                    selectView({ projectView: undefined, section: 'workstreams', page: 1 })
                  }
                >
                  Frentes do projeto
                </Button>
                <Button
                  aria-pressed={projectView === 'history'}
                  variant="secondary"
                  className={projectSectionButton}
                  onClick={() => selectView({ projectView: 'history', page: 1 })}
                >
                  Histórico
                </Button>
              </nav>
              <ProjectOverview project={projectData.project} review={projectData.review} />
              {admin &&
                projectOperations &&
                (['draft', 'adjustment_requested'].includes(projectData.project.planning_status) ||
                  (['active', 'rebriefing'].includes(projectData.project.planning_status) &&
                    projectData.project.execution_status !== 'cancelled')) && (
                  <details className={panel}>
                    <summary className="tw:cursor-pointer tw:font-semibold tw:text-brand">
                      Gerenciar projeto
                    </summary>
                    <div className="tw:mt-3 tw:grid tw:gap-3">
                      {['draft', 'adjustment_requested'].includes(
                        projectData.project.planning_status,
                      ) && (
                        <EditProject
                          scope={{ company: companyId, actor, project }}
                          plan={projectData.project}
                        />
                      )}
                      <ProjectActions
                        key={project}
                        company={companyId}
                        actor={actor}
                        project={project}
                        planning={projectData.project.planning_status}
                        review={projectData.review}
                        admin
                      />
                      {['active', 'rebriefing'].includes(projectData.project.planning_status) && (
                        <LifecycleActions
                          company={companyId}
                          actor={actor}
                          project={project}
                          execution={projectData.project.execution_status}
                        />
                      )}
                    </div>
                  </details>
                )}
              {!admin && (
                <ProjectActions
                  key={project}
                  company={companyId}
                  actor={actor}
                  project={project}
                  planning={projectData.project.planning_status}
                  review={projectData.review}
                  admin={false}
                />
              )}
              {projectView === 'history' ? (
                <ProjectJournalPanel
                  scope={{ company: companyId, actor, project }}
                  admin={admin}
                  standalone
                />
              ) : projectView === 'roadmap' ? (
                <ProjectRoadmap data={projectData} actor={actor} admin={admin} />
              ) : projectData.items.rows.length ? (
                <ProjectDeliverableList
                  rows={projectData.items.rows}
                  grouped={section === 'deliverables'}
                  admin={admin}
                  renderRow={(row) => (
                    <li key={row.id}>
                      <strong>{row.name}</strong>
                      {row.protocol && (
                        <p className="tw:text-caption tw:text-muted-copy">{row.protocol}</p>
                      )}
                      <p>
                        {label(row.status)} · {label(row.execution_status)}
                        {row.due_at ? ` · Prazo ${formatServerInstant(row.due_at)}` : ''}
                      </p>
                      {admin &&
                        ['draft', 'adjustment_requested'].includes(
                          projectData.project.planning_status,
                        ) && (
                          <EditPlanItem
                            scope={{ company: companyId, actor, project }}
                            item={row}
                            section={section}
                            draft={projectData.project.planning_status === 'draft'}
                          />
                        )}
                      {!admin &&
                        projectData.project.planning_status === 'client_review' &&
                        projectData.review?.id &&
                        projectData.review.status === 'pending' &&
                        projectData.review.number <= 2 && (
                          <ScheduleItemRequest
                            scope={{ company: companyId, actor, project }}
                            item={row}
                            section={section}
                            review={projectData.review.id}
                          />
                        )}
                      {admin &&
                        row.updated_at &&
                        !['approved', 'cancelled', 'completed'].includes(row.status) &&
                        projectData.project.execution_status === 'normal' &&
                        ['active', 'rebriefing'].includes(projectData.project.planning_status) && (
                          <details>
                            <summary>Execução de {row.name}</summary>
                            <LifecycleActions
                              company={companyId}
                              actor={actor}
                              project={project}
                              execution={row.execution_status}
                              item={{
                                id: row.id,
                                kind: section === 'workstreams' ? 'front' : 'deliverable',
                                version: row.updated_at,
                              }}
                            />
                          </details>
                        )}
                      {section === 'deliverables' && (
                        <ProjectJournalPanel
                          scope={{ company: companyId, actor, project }}
                          admin={admin}
                          delivery={row}
                          canOperate={
                            row.execution_status === 'normal' &&
                            projectData.project.execution_status === 'normal' &&
                            ['active', 'rebriefing'].includes(projectData.project.planning_status)
                          }
                        />
                      )}
                      {admin &&
                        section === 'deliverables' &&
                        !['approved', 'cancelled'].includes(row.status) &&
                        ['active', 'approved', 'rebriefing', 'closed'].includes(
                          projectData.project.planning_status,
                        ) && <HourLink company={companyId} delivery={row.id} />}
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
                              projectData?.project.execution_status === 'normal' &&
                              ['active', 'rebriefing'].includes(projectData.project.planning_status)
                            }
                          />
                        )}
                      {section === 'deliverables' &&
                        row.updated_at &&
                        row.execution_status === 'normal' &&
                        projectData?.project.execution_status === 'normal' &&
                        ['active', 'rebriefing'].includes(projectData.project.planning_status) && (
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
                  )}
                />
              ) : (
                <FeedbackState kind="empty">Nenhum item nesta página.</FeedbackState>
              )}
              {projectView !== 'history' && (
                <Pages total={projectData.items.total} search={search} update={update} />
              )}
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
              open={(created) => selectView({ project: created, page: 1 })}
            />
          )}
          {list.data.projects.length ? (
            <ul className="tw:m-0 tw:grid tw:list-none tw:gap-3 tw:p-0">
              {list.data.projects.map((row) => (
                <li key={row.id} className={`${panel} tw:wrap-anywhere`}>
                  <p>
                    <strong>{row.name}</strong>
                    {row.protocol ? ` · ${row.protocol}` : ''}
                  </p>
                  <p>
                    {label(row.planning_status)} · {label(row.execution_status)}
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => selectView({ project: row.id, page: 1 })}
                  >
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
    </section>
  );
}
