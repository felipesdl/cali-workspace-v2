import { useId, type ReactNode } from 'react';
import { Link, useRouteContext } from '@tanstack/react-router';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { type AdminOverviewSnapshot as Snapshot } from '../../../../api/admin/workspace/admin-portfolio';
import { type Company } from '../../../../api/admin/companies/schemas';
import { isPilotCompany } from '../../../../api/admin/companies/onboarding';
import { useOwnProfileQuery } from '../../../../api/access/hooks/useOwnProfileQuery';
import { workspaceSearch } from '../../../../api/shared/workspace/schemas';
import { Panel } from '../../../../components/ds/panel/Panel';
import { workspaceLabel } from '../../../../components/workspace/workspace-labels';
import { formatCalendarDate, formatServerInstant } from '../../../../lib/dates';
import { OverviewExport } from './OverviewExport';
import { overviewHours } from './overview-format';

const score = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const linkClass = 'tw:font-semibold tw:text-brand tw:underline-offset-2 tw:hover:underline';
const dateGreeting = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: 'numeric',
  hourCycle: 'h23',
});

const agendaDate = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: 'numeric',
  month: 'short',
});
const agendaTime = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
});
const activityClass =
  'tw:grid tw:min-w-0 tw:grid-cols-[auto_minmax(0,1fr)_auto] tw:items-center tw:gap-3 tw:py-1 tw:text-copy tw:no-underline';

type Row = {
  key: string;
  title: string;
  value?: string;
  activity?: ReactNode;
};

function OverviewList({
  title,
  empty,
  rows,
  action,
}: {
  title: string;
  empty: string;
  rows: Row[];
  action?: ReactNode;
}) {
  const id = useId();
  return (
    <Panel
      aria-labelledby={id}
      className="tw:grid tw:min-h-36 tw:content-start tw:gap-3 tw:wide:p-6!"
    >
      <div className="tw:flex tw:min-w-0 tw:flex-wrap tw:items-center tw:justify-between tw:gap-2 tw:border-b tw:border-border-default tw:pb-3">
        <h2 id={id} className="tw:m-0 tw:text-[15px] tw:font-bold">
          {title}
        </h2>
        {action}
      </div>
      {rows.length ? (
        <ul className="tw:m-0 tw:grid tw:list-none tw:divide-y tw:divide-border-default tw:p-0">
          {rows.map((row) => (
            <li key={row.key} className="tw:min-w-0 tw:py-2 tw:text-caption tw:wrap-anywhere">
              {row.activity ?? (
                <div className="tw:flex tw:flex-wrap tw:justify-between tw:gap-x-3 tw:gap-y-1">
                  <span>{row.title}</span>
                  {row.value && <span className="tw:text-muted-copy">{row.value}</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="tw:m-0 tw:text-caption tw:text-muted-copy">{empty}</p>
      )}
    </Panel>
  );
}

export function AdminOverviewSnapshot({
  data,
  scope,
  companies,
}: {
  data: Snapshot;
  scope: string;
  companies: readonly Company[];
}) {
  const { projectWorkspace, adminRead } = useRouteContext({ from: '__root__' });
  const { query: ownProfile } = useOwnProfileQuery();
  const name = ownProfile.isSuccess
    ? ownProfile.data?.full_name?.trim().split(/\s+/)[0]
    : undefined;
  const satisfaction =
    data.satisfaction.average === null
      ? 'Sem avaliações'
      : `${score.format(data.satisfaction.average)} / 5`;
  const hours = overviewHours(data.hoursMinutes);
  const hour = Number(dateGreeting.format(new Date()));
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const companyId = isPilotCompany(data.companyId ?? undefined) ? data.companyId : undefined;
  const scoped = workspaceSearch.parse({ companyId });
  const canOpenOperations = Boolean(projectWorkspace && (!data.companyId || companyId));
  const actionClass =
    'tw:inline-flex tw:items-center tw:gap-2 tw:text-caption tw:text-copy tw:no-underline tw:hover:text-brand tw:hover:underline';
  const metrics = [
    {
      label: 'Contas ativas',
      value: String(data.activeAccounts),
      detail: 'Contas com situação ativa',
      accent: 'tw:border-t-[#3caf80]',
      to: '/admin/clientes' as const,
      search: { q: '', status: 'active' as const },
    },
    {
      label: 'Ações pendentes',
      value: String(data.pendingActions),
      detail: 'Projetos e ocorrências',
      accent: 'tw:border-t-[#dfa848]',
      to: '/admin/projetos' as const,
      search: scoped,
    },
    {
      label: 'Horas no mês',
      value: hours,
      detail: data.contractedMinutes
        ? `${Math.round((100 * data.hoursMinutes) / data.contractedMinutes)}% das ${overviewHours(data.contractedMinutes)} contratadas`
        : 'Sem limite contratado informado',
      accent: 'tw:border-t-[#7aafcd]',
      to: '/admin/horas' as const,
      search: { ...scoped, month: data.month },
    },
    {
      label: 'Satisfação média',
      value: satisfaction,
      detail: `${data.satisfaction.total} ${data.satisfaction.total === 1 ? 'avaliação' : 'avaliações'} · escala 1–5`,
      accent: 'tw:border-t-[#a484d7]',
      to: '/admin/satisfacao' as const,
      search: { ...scoped, month: data.month },
    },
  ] as const;
  const companyNames = new Map(companies.map(({ id, displayName }) => [id, displayName]));
  const priorities = data.priorities.map(({ id, companyId, title, kind }, index): Row => {
    const project = kind === 'project';
    const value = project ? 'Ajuste solicitado' : 'Ocorrência em atendimento';
    const details = [companyNames.get(companyId), value].filter(Boolean).join(' · ');
    const content = (
      <>
        <span aria-hidden="true" className="tw:min-w-6 tw:text-[16px] tw:font-medium tw:text-gold">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="tw:grid tw:min-w-0 tw:gap-1">
          <strong className="tw:text-caption">{title}</strong>
          <small className="tw:text-[10px] tw:text-muted-copy">{details}</small>
        </span>
      </>
    );
    return {
      key: `${kind}:${id}`,
      title,
      value,
      activity:
        projectWorkspace && isPilotCompany(companyId) ? (
          <Link
            to={project ? '/admin/projetos' : '/admin/registros'}
            search={workspaceSearch.parse({
              companyId,
              project: project ? id : undefined,
              record: project ? undefined : id,
            })}
            className={`${activityClass} tw:hover:text-brand`}
          >
            {content}
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        ) : (
          <div className={activityClass}>{content}</div>
        ),
    };
  });
  const agenda = data.agenda.map(({ id, title, startsAt, companyId }): Row => {
    const date = new Date(startsAt);
    const companyName = companyNames.get(companyId);
    const content = (
      <>
        <time dateTime={startsAt} className="tw:text-[11px] tw:font-bold tw:text-muted-copy">
          {agendaDate.format(date).replace('.', '')} · {agendaTime.format(date)}
        </time>
        <span className="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
          <span
            aria-hidden="true"
            className="tw:size-2 tw:shrink-0 tw:rounded-full tw:bg-[#a484d7]"
          />
          <span className="tw:grid tw:min-w-0 tw:gap-1">
            <strong className="tw:text-caption">{title}</strong>
            {companyName && (
              <small className="tw:text-[10px] tw:text-muted-copy">{companyName}</small>
            )}
          </span>
        </span>
      </>
    );
    return {
      key: id,
      title,
      value: formatServerInstant(startsAt),
      activity:
        projectWorkspace && isPilotCompany(companyId) ? (
          <Link
            to="/admin/calendario"
            search={workspaceSearch.parse({ companyId })}
            className={`${activityClass} tw:hover:text-brand`}
          >
            {content}
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        ) : (
          <div className={activityClass}>{content}</div>
        ),
    };
  });
  const consumption = data.hoursByCompany.map(
    ({ companyId, name, minutes, contractedMinutes }): Row => ({
      key: companyId,
      title: name,
      value:
        contractedMinutes > 0
          ? `${overviewHours(minutes)} de ${overviewHours(contractedMinutes)}`
          : overviewHours(minutes),
    }),
  );
  const deliverables = data.deliverables.map(({ status, total }): Row => ({
    key: status,
    title: workspaceLabel(status),
    value: String(total),
  }));
  const deadlines = data.deadlines.map(({ id, title, dueOn }): Row => ({
    key: id,
    title,
    value: formatCalendarDate(dueOn),
  }));
  const ratings =
    data.satisfaction.total > 0
      ? data.satisfaction.distribution.map(({ score, total }): Row => ({
          key: String(score),
          title: `Nota ${score}`,
          value: String(total),
        }))
      : [];
  const lists = [
    {
      title: 'Prioridades de hoje',
      empty: 'Nenhuma ação pendente neste recorte.',
      rows: priorities,
      action: canOpenOperations && (
        <Link to="/admin/projetos" search={scoped} className={actionClass}>
          Abrir acompanhamento <ArrowRight aria-hidden="true" size={14} />
        </Link>
      ),
    },
    {
      title: 'Agenda da CALI',
      empty: 'Nenhum compromisso nos próximos 15 dias.',
      rows: agenda,
      action: canOpenOperations && (
        <Link to="/admin/calendario" search={scoped} className={actionClass}>
          Ver calendário <ArrowRight aria-hidden="true" size={14} />
        </Link>
      ),
    },
    {
      title: 'Consumo de horas por cliente',
      empty: 'Nenhuma conta com consumo ou limite neste recorte.',
      rows: consumption,
    },
    {
      title: 'Situação dos entregáveis',
      empty: 'Nenhum entregável neste recorte.',
      rows: deliverables,
    },
    {
      title: 'Satisfação',
      empty: 'Nenhuma avaliação neste recorte.',
      rows: ratings,
      action: adminRead && (
        <Link
          to="/admin/satisfacao"
          search={{ ...scoped, companyId: data.companyId ?? undefined, month: data.month }}
          className={actionClass}
        >
          Ver avaliações <ArrowRight aria-hidden="true" size={14} />
        </Link>
      ),
    },
    {
      title: 'Próximos prazos',
      empty: 'Nenhum entregável com prazo nos próximos 15 dias.',
      rows: deadlines,
    },
  ];
  const statusColors = [
    'var(--color-brand-burgundy)',
    'var(--color-brand-gold)',
    'var(--feedback-success-border)',
    'var(--color-status-review)',
    'var(--color-status-rebriefing)',
  ];
  const totalDeliverables = data.deliverables.reduce((total, row) => total + row.total, 0);
  const donut = data.deliverables.reduce<{ cursor: number; stops: string[] }>(
    ({ cursor, stops }, { total }, index) => {
      const next = cursor + (totalDeliverables ? (100 * total) / totalDeliverables : 0);
      return {
        cursor: next,
        stops: [...stops, `${statusColors[index % statusColors.length]} ${cursor}% ${next}%`],
      };
    },
    { cursor: 0, stops: [] },
  ).stops;
  const accountRows = companies.filter(
    (company) => !data.companyId || company.id === data.companyId,
  );

  return (
    <div className="tw:grid tw:min-w-0 tw:gap-4">
      <Panel className="tw:flex tw:min-h-36 tw:flex-wrap tw:items-end tw:justify-between tw:gap-4 tw:bg-[linear-gradient(110deg,#fbf6f3,#f3e8e4)] tw:p-6! tw:wide:p-8!">
        <div className="tw:grid tw:min-w-0 tw:gap-2">
          <p className="workspace-eyebrow tw:m-0">CALI · Operação</p>
          <h2 className="tw:m-0 tw:text-[clamp(1.5rem,3vw,2rem)] tw:font-bold tw:tracking-tight tw:wrap-anywhere">
            {name ? `${greeting}, ${name}.` : 'Visão da operação'}
          </h2>
          <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
            {scope} · O que precisa de decisão agora, quais contas merecem atenção e como cada ciclo
            está avançando.
          </p>
        </div>
        <OverviewExport
          month={data.month}
          scope={scope}
          content={{
            metrics: metrics.map(({ label, value }) => [label, value]),
            sections: lists.map(({ title, empty, rows }) => ({
              title,
              rows: rows.length
                ? rows.map(({ title, value }) => [title, value ?? ''])
                : [['', empty]],
            })),
          }}
        />
      </Panel>
      <Panel aria-label="Indicadores operacionais" className="tw:overflow-hidden tw:p-0!">
        <div className="tw:grid tw:grid-cols-2 tw:gap-px tw:bg-border-default tw:wide:grid-cols-4">
          {metrics.map(({ label, value, detail, accent, to, search }) => (
            <Link
              to={to}
              search={search}
              key={label}
              className={`tw:box-border tw:grid tw:min-h-[124px] tw:min-w-0 tw:content-start tw:gap-3 tw:border-t-[3px] tw:bg-panel tw:p-4 tw:wrap-anywhere tw:text-copy tw:no-underline tw:hover:bg-ivory tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-focus tw:wide:p-5 ${accent}`}
            >
              <small className="tw:text-[length:var(--workspace-text-control)] tw:text-muted-copy">
                {label}
              </small>
              <strong className="tw:text-[24px] tw:font-semibold tw:text-brand">{value}</strong>
              <span className="tw:text-[10px] tw:text-muted-copy">{detail}</span>
            </Link>
          ))}
        </div>
      </Panel>
      <div className="tw:grid tw:min-w-0 tw:gap-4 tw:wide:grid-cols-2">
        {lists.slice(0, 2).map((list) => (
          <OverviewList key={list.title} {...list} />
        ))}
      </div>
      <div className="tw:grid tw:min-w-0 tw:gap-4 tw:wide:grid-cols-[1.35fr_1fr]">
        <Panel
          aria-labelledby="overview-hours-title"
          className="tw:grid tw:content-start tw:gap-3 tw:wide:p-6!"
        >
          <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2 tw:border-b tw:border-border-default tw:pb-3">
            <h2 id="overview-hours-title" className="tw:m-0 tw:text-body tw:font-bold">
              Consumo de horas por cliente
            </h2>
            {canOpenOperations && (
              <Link
                to="/admin/horas"
                search={{ ...scoped, month: data.month }}
                className={actionClass}
              >
                Detalhar horas <ArrowRight aria-hidden="true" size={14} />
              </Link>
            )}
          </div>
          {consumption.length ? (
            <ul className="tw:m-0 tw:grid tw:list-none tw:divide-y tw:divide-border-default tw:p-0">
              {data.hoursByCompany.map((row) => {
                const percent =
                  row.contractedMinutes > 0
                    ? Math.round((row.minutes * 100) / row.contractedMinutes)
                    : null;
                return (
                  <li
                    key={row.companyId}
                    className="tw:flex tw:min-w-0 tw:items-center tw:gap-3 tw:py-3"
                  >
                    <span
                      aria-hidden="true"
                      className="tw:grid tw:size-9 tw:shrink-0 tw:place-items-center tw:rounded-control tw:border tw:border-border-default tw:bg-ivory tw:font-bold tw:text-brand"
                    >
                      {row.name.trim().slice(0, 1).toLocaleUpperCase('pt-BR')}
                    </span>
                    <span className="tw:grid tw:min-w-0 tw:flex-1 tw:gap-1">
                      {projectWorkspace && isPilotCompany(row.companyId) ? (
                        <Link
                          to="/admin/horas"
                          search={workspaceSearch.parse({
                            companyId: row.companyId,
                            month: data.month,
                          })}
                          className={linkClass}
                        >
                          {row.name}
                        </Link>
                      ) : (
                        <strong className="tw:wrap-anywhere">{row.name}</strong>
                      )}
                      <span className="tw:text-caption tw:text-muted-copy">
                        {overviewHours(row.minutes)}
                        {row.contractedMinutes > 0
                          ? ` de ${overviewHours(row.contractedMinutes)} contratadas`
                          : ''}
                      </span>
                      {percent !== null && (
                        <span
                          aria-label={`${percent}% consumido`}
                          className="tw:h-2 tw:overflow-hidden tw:rounded-full tw:bg-ivory"
                        >
                          <span
                            className="tw:block tw:h-full tw:rounded-full tw:bg-brand"
                            style={{ width: `${Math.min(100, percent)}%` }}
                          />
                        </span>
                      )}
                    </span>
                    <strong className="tw:text-brand">
                      {percent === null ? '—' : `${percent}%`}
                    </strong>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
              Nenhuma conta com consumo ou limite neste recorte.
            </p>
          )}
        </Panel>
        <Panel
          aria-labelledby="overview-deliverable-status-title"
          className="tw:grid tw:content-start tw:gap-3 tw:wide:p-6!"
        >
          <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2 tw:border-b tw:border-border-default tw:pb-3">
            <h2 id="overview-deliverable-status-title" className="tw:m-0 tw:text-body tw:font-bold">
              Status dos entregáveis
            </h2>
            {canOpenOperations && (
              <Link to="/admin/projetos" search={scoped} className={actionClass}>
                Abrir projetos <ArrowRight aria-hidden="true" size={14} />
              </Link>
            )}
          </div>
          {data.deliverables.length ? (
            <>
              <div
                role="img"
                aria-label={data.deliverables
                  .map(({ status, total }) => `${workspaceLabel(status)}: ${total}`)
                  .join(', ')}
                className="tw:mx-auto tw:grid tw:size-40 tw:place-items-center tw:rounded-full"
                style={{ background: `conic-gradient(${donut.join(', ')})` }}
              >
                <span className="tw:grid tw:size-28 tw:place-content-center tw:rounded-full tw:bg-panel tw:text-center">
                  <strong className="tw:text-section tw:text-brand">{totalDeliverables}</strong>
                  <small>no portfólio</small>
                </span>
              </div>
              <ul className="tw:m-0 tw:grid tw:list-none tw:gap-2 tw:p-0">
                {data.deliverables.map(({ status, total }, index) => (
                  <li key={status} className="tw:flex tw:items-center tw:gap-2 tw:text-caption">
                    <span
                      aria-hidden="true"
                      className="tw:size-2 tw:rounded-full"
                      style={{ backgroundColor: statusColors[index % statusColors.length] }}
                    />
                    {workspaceLabel(status)}
                    <strong className="tw:ml-auto">{total}</strong>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
              Ainda não há entregáveis para consolidar.
            </p>
          )}
        </Panel>
      </div>
      <div className="tw:grid tw:min-w-0 tw:gap-4 tw:wide:grid-cols-2">
        {lists.slice(4).map((list) => (
          <OverviewList key={list.title} {...list} />
        ))}
      </div>
      <Panel
        aria-labelledby="overview-accounts-title"
        className="tw:grid tw:content-start tw:gap-3 tw:wide:p-6!"
      >
        <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2 tw:border-b tw:border-border-default tw:pb-3">
          <h2 id="overview-accounts-title" className="tw:m-0 tw:text-body tw:font-bold">
            Carteira de clientes
          </h2>
          <Link to="/admin/clientes" search={{ q: '', status: 'all' }} className={actionClass}>
            Todas as contas <ArrowRight aria-hidden="true" size={14} />
          </Link>
        </div>
        {accountRows.length ? (
          <ul className="tw:m-0 tw:grid tw:list-none tw:gap-3 tw:p-0 tw:wide:grid-cols-3">
            {accountRows.map((company) => (
              <li key={company.id}>
                <Link
                  to="/admin/clientes"
                  search={{ q: company.displayName, status: 'all' }}
                  className="tw:flex tw:min-h-16 tw:min-w-0 tw:items-center tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:p-3 tw:text-copy tw:no-underline tw:hover:bg-ivory tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-focus"
                >
                  <span
                    aria-hidden="true"
                    className="tw:grid tw:size-9 tw:shrink-0 tw:place-items-center tw:rounded-control tw:bg-ivory tw:font-bold tw:text-brand"
                  >
                    {company.displayName.trim().slice(0, 1).toLocaleUpperCase('pt-BR')}
                  </span>
                  <span className="tw:grid tw:min-w-0 tw:flex-1 tw:gap-1">
                    <strong className="tw:wrap-anywhere">{company.displayName}</strong>
                    <small className="tw:text-muted-copy">
                      {company.plan ? workspaceLabel(company.plan) : 'Plano não informado'}
                    </small>
                  </span>
                  <span className="tw:rounded-pill tw:border tw:border-border-default tw:px-2 tw:py-1 tw:text-caption">
                    {workspaceLabel(company.status)}
                  </span>
                  <ArrowRight aria-hidden="true" size={15} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
            Nenhuma empresa disponível neste recorte.
          </p>
        )}
      </Panel>
    </div>
  );
}
