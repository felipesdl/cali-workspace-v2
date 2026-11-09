import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import {
  partnerModule,
  hasPartnerItemDetail,
  type PartnerModule,
  type PartnerPilot,
} from '../../api/modules/partner/pilot';
import { Button } from '../../components/ds/button/Button';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { formatCalendarDate, formatServerInstant } from '../../lib/dates';
import { CodeForm } from '../access/CodeForm';
import { MfaForm } from '../access/MfaForm';
import { TermsAcceptance } from '../access/TermsAcceptance';
import { WorkspacePagination } from '../project-workspace/WorkspacePagination';
import { workspaceLabel } from '../project-workspace/workspace-labels';
import { PartnerItemDetail } from './PartnerItemDetail';
import { PartnerHoursQueue } from './PartnerHoursQueue';
import { PartnerTimer } from './PartnerTimer';

const labels = {
  projects: 'Projetos',
  records: 'Ocorrências',
  hours: 'Minhas horas',
  calendar: 'Agenda',
  documents: 'Documentos',
  reports: 'Relatórios',
  notices: 'Avisos',
  team: 'Equipe',
} satisfies Record<PartnerModule, string>;
const panel =
  'tw:grid tw:min-w-0 tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4';

type Ready = Extract<Awaited<ReturnType<PartnerPilot['read']>>, { status: 'ready' }>;

function PartnerItems({
  api,
  access,
  module,
}: {
  api: PartnerPilot;
  access: Ready;
  module: PartnerModule;
}) {
  const [page, setPage] = useState(1);
  const [item, setItem] = useState<string>();
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
        back={() => setItem(undefined)}
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
      <h2 className="tw:text-section tw:font-semibold">{labels[module]}</h2>
      {result.data.rows.length ? (
        <ul className="tw:grid tw:gap-3">
          {result.data.rows.map((row) => (
            <li
              key={row.id}
              className="tw:grid tw:gap-1 tw:border-b tw:border-border-default tw:pb-3"
            >
              <strong className="tw:wrap-anywhere">{row.title || 'Sem descrição'}</strong>
              <p>
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
                <p className="tw:wrap-anywhere tw:whitespace-pre-line">{row.summary}</p>
              )}
              {hasPartnerItemDetail(module) && (
                <div>
                  <Button
                    variant="secondary"
                    onClick={() => setItem(row.id)}
                    aria-label={`Abrir ${row.title ?? 'registro'}`}
                  >
                    Abrir detalhe
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <FeedbackState kind="empty">Nenhum registro nesta página.</FeedbackState>
      )}
      <WorkspacePagination total={result.data.total} page={page} change={setPage} />
      {module === 'hours' && (
        <>
          <PartnerTimer api={api} actor={access.actor} company={access.company} />
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

function PartnerModules({ api, access }: { api: PartnerPilot; access: Ready }) {
  const [selected, setSelected] = useState<PartnerModule>();
  const available = partnerModule.options.filter((module) => access.modules.includes(module));
  const active = selected && available.includes(selected) ? selected : available[0];
  return (
    <>
      <section className={panel} aria-label="Empresa atribuída">
        <p className="tw:text-caption tw:font-semibold tw:text-brand">EMPRESA ATRIBUÍDA</p>
        <h2 className="tw:text-section tw:font-semibold">{access.companyName}</h2>
        {active && (
          <nav className="tw:flex tw:flex-wrap tw:gap-2" aria-label="Módulos da Equipe CALI">
            {available.map((module) => (
              <Button
                key={module}
                variant="secondary"
                aria-pressed={active === module}
                onClick={() => setSelected(module)}
              >
                {labels[module]}
              </Button>
            ))}
          </nav>
        )}
      </section>
      {active ? (
        <PartnerItems key={active} api={api} access={access} module={active} />
      ) : (
        <FeedbackState kind="empty">Nenhum módulo de homologação atribuído.</FeedbackState>
      )}
    </>
  );
}

function PartnerGate({ api }: { api: PartnerPilot }) {
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

  if (query.isPending)
    return <FeedbackState kind="loading">Confirmando acesso da Equipe CALI…</FeedbackState>;
  if (query.isError)
    return (
      <FeedbackState kind="error" onRetry={() => void query.refetch()}>
        Não foi possível confirmar o acesso.
      </FeedbackState>
    );
  const state = query.data;
  if (state.status === 'ready')
    return <PartnerModules key={state.actor + state.company} api={api} access={state} />;

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
  return (
    <section className={panel} aria-label="Acesso da Equipe CALI">
      {content}
      {confirmation.isError && <p role="alert">{confirmation.error.message}</p>}
    </section>
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
  return (
    <div className="tw:min-h-screen tw:bg-ivory tw:text-body tw:text-copy">
      <header className="tw:border-b tw:border-border-default tw:bg-panel tw:px-6 tw:py-4 tw:font-bold tw:text-brand">
        CALI · WORKSPACE
      </header>
      <main className="tw:mx-auto tw:grid tw:max-w-5xl tw:gap-4 tw:p-6">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3">
          <h1 className="tw:text-section tw:font-bold tw:text-brand">Equipe CALI</h1>
          {session && !signedOut && (
            <Button variant="secondary" onClick={() => void logout()}>
              Sair da sessão
            </Button>
          )}
        </div>
        {signedOut ? (
          <FeedbackState kind="empty">Sessão encerrada.</FeedbackState>
        ) : (
          <PartnerGate api={partnerPilot} />
        )}
      </main>
    </div>
  );
}
