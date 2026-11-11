import { FeedbackMessage } from '../../../components/ds/feedback/FeedbackMessage';
import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi, Link, useRouteContext } from '@tanstack/react-router';
import {
  partnerModule,
  hasPartnerItemDetail,
  type PartnerModule,
  type PartnerPilot,
} from '../../../api/partner/pilot';
import { Button } from '../../../components/ds/button/Button';
import { FeedbackState } from '../../../components/ds/feedback/FeedbackState';
import { formatCalendarDate, formatServerInstant } from '../../../lib/dates';
import { CodeForm } from '../../access/sign-in/components/CodeForm';
import { MfaForm } from '../../access/sign-in/components/MfaForm';
import { TermsAcceptance } from '../../access/sign-in/components/TermsAcceptance';
import { PdfDownload } from '../../../components/documents/PdfDownload';
import { WorkspacePagination } from '../../../components/workspace/WorkspacePagination';
import { workspaceLabel } from '../../../components/workspace/workspace-labels';
import { PartnerItemDetail } from './components/PartnerItemDetail';
import { PartnerHoursQueue } from './components/PartnerHoursQueue';
import { PartnerProposalDrafts } from './components/PartnerProposalDrafts';
import { PartnerTimer } from './components/PartnerTimer';
import { PartnerReviewQueue } from './components/PartnerReviewQueue';
import { PartnerReportDraftsPanel } from './components/PartnerReportDraftsPanel';
import { PartnerMapaOpinionDrafts } from './components/PartnerMapaOpinionDrafts';
import { WorkspaceFrame } from '../../../app/WorkspaceFrame';
import { WorkspaceNavLabel } from '../../../app/WorkspaceNavLabel';

const labels = {
  projects: 'Projetos',
  records: 'Ocorrências',
  hours: 'Minhas horas',
  calendar: 'Agenda',
  documents: 'Documentos',
  reports: 'Relatórios',
  notices: 'Avisos',
  team: 'Equipe',
} as const satisfies Record<PartnerModule, string>;
const panel =
  'tw:grid tw:min-w-0 tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4';
const partnerRoute = getRouteApi('/equipe');
// Ordem da navegação Partner do app.cali, aplicada só aos módulos atribuídos na V2.
const partnerNavigation = [
  'team',
  'projects',
  'hours',
  'calendar',
  'records',
  'documents',
  'reports',
  'notices',
] as const satisfies readonly PartnerModule[];

type Ready = Extract<Awaited<ReturnType<PartnerPilot['read']>>, { status: 'ready' }>;

function PartnerReportDownload({
  api,
  company,
  report,
  version,
}: {
  api: PartnerPilot;
  company: string;
  report: string;
  version: number;
}) {
  return (
    <PdfDownload
      key={version}
      download={(signal) => api.reportPdf(company, report, version, signal)}
    />
  );
}

function PartnerItems({
  api,
  access,
  module,
}: {
  api: PartnerPilot;
  access: Ready;
  module: PartnerModule;
}) {
  const { partnerReportDrafts } = useRouteContext({ from: '__root__' });
  const [page, setPage] = useState(1);
  const [item, setItem] = useState<string>();
  const [returnItem, setReturnItem] = useState<string>();
  const result = useQuery({
    queryKey: ['partner-items', access.actor, access.company, module, page],
    queryFn: ({ signal }) => api.items(access.company, module, page, signal),
    refetchInterval: 30000,
  });
  if (item && hasPartnerItemDetail(module)) {
    return (
      <PartnerItemDetail
        key={item}
        api={api}
        actor={access.actor}
        company={access.company}
        module={module}
        id={item}
        back={() => {
          setReturnItem(item);
          setItem(undefined);
        }}
      />
    );
  }
  if (result.isPending)
    return <FeedbackState kind="loading">Carregando {labels[module].toLowerCase()}…</FeedbackState>;
  if (result.isError)
    return (
      <FeedbackState kind="error" onRetry={() => void result.refetch()}>
        Não foi possível consultar este módulo.
      </FeedbackState>
    );
  return (
    <section className={panel} aria-label={labels[module]}>
      {result.data.rows.length ? (
        <ul className="tw:m-0 tw:grid tw:list-none tw:gap-3 tw:p-0">
          {result.data.rows.map((row) => {
            const revision = row.downloadRevision;
            return (
              <li
                key={row.id}
                className="tw:grid tw:gap-1 tw:border-b tw:border-border-default tw:pb-3"
              >
                <strong className="tw:wrap-anywhere">{row.title || 'Sem descrição'}</strong>
                <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
                  {[
                    row.protocol,
                    row.status && workspaceLabel(row.status),
                    row.instant
                      ? formatServerInstant(row.instant)
                      : row.day && formatCalendarDate(row.day),
                    row.minutes !== null && `${row.minutes} min`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {row.summary && (
                  <p className="tw:m-0 tw:wrap-anywhere tw:whitespace-pre-line">{row.summary}</p>
                )}
                {module === 'documents' && revision && (
                  <PdfDownload
                    key={revision}
                    download={(signal) => api.documentPdf(access.company, row.id, revision, signal)}
                  />
                )}
                {module === 'reports' && row.downloadVersion != null && (
                  <PartnerReportDownload
                    api={api}
                    company={access.company}
                    report={row.id}
                    version={row.downloadVersion}
                  />
                )}
                {hasPartnerItemDetail(module) && (
                  <div>
                    <Button
                      variant="secondary"
                      autoFocus={returnItem === row.id}
                      onClick={() => {
                        setReturnItem(undefined);
                        setItem(row.id);
                      }}
                      aria-label={`Abrir ${row.title ?? 'registro'}`}
                    >
                      Abrir detalhe
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <FeedbackState kind="empty">Nenhum registro nesta página.</FeedbackState>
      )}
      <WorkspacePagination total={result.data.total} page={page} change={setPage} />
      {module === 'reports' && partnerReportDrafts && (
        <PartnerReportDraftsPanel
          service={partnerReportDrafts}
          company={access.company}
          actor={access.actor}
        />
      )}
      {module === 'hours' && (
        <>
          <PartnerHoursQueue
            api={api}
            actor={access.actor}
            company={access.company}
            admin={false}
          />
        </>
      )}
    </section>
  );
}

function PartnerModules({
  api,
  access,
  actions,
}: {
  api: PartnerPilot;
  access: Ready;
  actions?: ReactNode;
}) {
  const { modulo } = partnerRoute.useSearch();
  const available = partnerModule.options.filter((module) => access.modules.includes(module));
  const denied = Boolean(modulo && !available.includes(modulo));
  const active = denied ? undefined : (modulo ?? available[0]);
  return (
    <WorkspaceFrame
      title={active ? labels[active] : 'Equipe CALI'}
      area="Equipe CALI"
      actions={actions}
      modules={partnerNavigation
        .filter((module) => available.includes(module))
        .map((module) => ({
          label: labels[module],
          element: (
            <Link
              to="/equipe"
              search={{ modulo: module }}
              activeOptions={{ exact: true, includeSearch: true, explicitUndefined: true }}
              inactiveProps={active === module ? { 'aria-current': 'page' } : undefined}
            >
              <WorkspaceNavLabel label={labels[module]} />
            </Link>
          ),
        }))}
    >
      <div className="tw:grid tw:min-w-0 tw:gap-4 tw:wrap-anywhere">
        <section
          className={`${panel} tw:flex tw:items-center tw:gap-4`}
          aria-label="Empresa atribuída"
        >
          <span
            aria-hidden="true"
            className="tw:grid tw:size-11 tw:shrink-0 tw:place-items-center tw:rounded-media tw:border tw:border-border-default tw:bg-ivory tw:font-semibold tw:text-brand"
          >
            {access.companyName.trim().slice(0, 1).toLocaleUpperCase('pt-BR')}
          </span>
          <div className="tw:min-w-0">
            <p className="workspace-eyebrow tw:m-0">Empresa atribuída</p>
            <h2 className="tw:mt-1 tw:mb-0 tw:text-section tw:font-semibold">
              {access.companyName}
            </h2>
          </div>
        </section>
        {available.includes('hours') && (
          <PartnerTimer api={api} actor={access.actor} company={access.company} />
        )}
        <PartnerProposalDrafts company={access.company} actor={access.actor} />
        <PartnerMapaOpinionDrafts />
        {active ? (
          <PartnerItems key={active} api={api} access={access} module={active} />
        ) : (
          <FeedbackState kind="empty">
            {denied
              ? 'Este módulo não está disponível para o seu acesso.'
              : 'Nenhum módulo de homologação atribuído.'}
          </FeedbackState>
        )}
        {!denied && (available.includes('projects') || available.includes('records')) && (
          <PartnerReviewQueue
            api={api}
            company={access.company}
            actor={access.actor}
            admin={false}
          />
        )}
      </div>
    </WorkspaceFrame>
  );
}

function PartnerGate({ api, actions }: { api: PartnerPilot; actions?: ReactNode }) {
  const { access } = useRouteContext({ from: '__root__' });
  const [agreedHash, setAgreedHash] = useState<string>();
  const cache = useQueryClient();
  useEffect(
    () =>
      api.subscribe(() => {
        void cache.invalidateQueries({ queryKey: ['partner-pilot'] });
      }),
    [api, cache],
  );
  const query = useQuery({
    queryKey: ['partner-pilot'],
    queryFn: ({ signal }) => api.read(signal),
    refetchInterval: 30000,
  });
  const confirmation = useMutation({
    mutationFn: async () => {
      const state = query.data;
      if (state?.status === 'invite_required') await api.acceptInvite();
      if (state?.status === 'terms_required') await api.acceptTerms(state.terms);
    },
    onSuccess: () => query.refetch(),
  });

  const accessFrame = (content: ReactNode) => (
    <WorkspaceFrame title="Equipe CALI" actions={actions}>
      {content}
    </WorkspaceFrame>
  );
  if (query.isPending)
    return accessFrame(
      <FeedbackState kind="loading">Confirmando acesso da Equipe CALI…</FeedbackState>,
    );
  if (query.isError)
    return accessFrame(
      <FeedbackState kind="error" onRetry={() => void query.refetch()}>
        Não foi possível confirmar o acesso.
      </FeedbackState>,
    );
  const state = query.data;
  if (state.status === 'ready')
    return (
      <PartnerModules
        key={state.actor + state.company}
        api={api}
        access={state}
        actions={actions}
      />
    );

  let content;
  switch (state.status) {
    case 'mfa_required':
      content = access && (
        <MfaForm
          api={access}
          audience="Partner"
          onConfirmed={async () => {
            await query.refetch();
          }}
        />
      );
      break;
    case 'invite_required':
      content = (
        <Button pending={confirmation.isPending} onClick={() => confirmation.mutate()}>
          Aceitar convite de teste
        </Button>
      );
      break;
    case 'terms_required':
      content = (
        <TermsAcceptance
          terms={state.terms}
          agreed={agreedHash === state.terms.contentHash}
          busy={confirmation.isPending}
          setAgreed={(checked) => setAgreedHash(checked ? state.terms.contentHash : undefined)}
          accept={async () => {
            confirmation.mutate();
          }}
        />
      );
      break;
    case 'signed_out':
      content = (
        <CodeForm
          api={api}
          codeLength={api.codeLength}
          qa={api.qa}
          onConfirmed={async () => {
            await query.refetch();
          }}
        />
      );
      break;
    case 'terms_unavailable':
      content = <FeedbackState kind="error">Os termos vigentes estão indisponíveis.</FeedbackState>;
      break;
    default:
      content = (
        <FeedbackState kind="error">Seu acesso à Equipe CALI está indisponível.</FeedbackState>
      );
  }
  return accessFrame(
    <section className={panel} aria-label="Acesso da Equipe CALI">
      {content}
      {confirmation.isError && (
        <FeedbackMessage tone="error">{confirmation.error.message}</FeedbackMessage>
      )}
    </section>,
  );
}

export function PartnerWorkspace() {
  const { partnerPilot, session } = useRouteContext({ from: '__root__' });
  const [signedOut, setSignedOut] = useState(false);
  const logout = async () => {
    setSignedOut(true);
    await session?.signOut();
  };
  if (!partnerPilot)
    return (
      <FeedbackState kind="empty">A Equipe CALI está indisponível neste ambiente.</FeedbackState>
    );
  if (signedOut)
    return (
      <WorkspaceFrame title="Equipe CALI">
        <FeedbackState kind="empty">Sessão encerrada.</FeedbackState>
      </WorkspaceFrame>
    );
  return (
    <PartnerGate
      api={partnerPilot}
      actions={
        session && (
          <Button variant="secondary" aria-label="Sair da sessão" onClick={() => void logout()}>
            Sair
          </Button>
        )
      }
    />
  );
}
