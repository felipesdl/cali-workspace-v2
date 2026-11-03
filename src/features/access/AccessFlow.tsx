import { type HostedAccessApi } from '../../api/modules/access/api';
import { type SessionController, type SessionState } from '../../app/session/controller';
import { type WorkspaceAccessState } from '../../api/modules/access/session';
import { Button } from '../../components/ds/button/Button';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { CodeForm } from './CodeForm';
import { MfaForm } from './MfaForm';
import { TermsAcceptance } from './TermsAcceptance';
import { useAccessFlow } from './hooks/useAccessFlow';
import { useTermsAcceptance } from './hooks/useTermsAcceptance';

const accessTitles = {
  terms_required: 'Termos de uso e privacidade',
  mfa_required: 'Confirme seu acesso Admin',
} satisfies Partial<Record<WorkspaceAccessState['status'], string>>;

function accessTitle(status: WorkspaceAccessState['status'] | undefined) {
  if (status === 'terms_required' || status === 'mfa_required') return accessTitles[status];
  return 'Acesse seu Workspace';
}

type AccessStepProps = {
  api: HostedAccessApi;
  session: SessionController;
  state: SessionState;
  access: WorkspaceAccessState | null;
  acceptance: ReturnType<typeof useTermsAcceptance>;
};
function AccessStep({ api, session, state, access, acceptance }: AccessStepProps) {
  switch (state.phase) {
    case 'loading':
    case 'idle':
      return <FeedbackState kind="loading">Confirmando acesso…</FeedbackState>;
    case 'error':
      return (
        <FeedbackState kind="error" onRetry={() => void session.refresh()}>
          Não foi possível confirmar seu acesso.
        </FeedbackState>
      );
  }
  switch (access?.status) {
    case 'blocked':
      return (
        <FeedbackState kind="error">
          Seu acesso está indisponível. Entre em contato com a CALI.
        </FeedbackState>
      );
    case 'mfa_required':
      return <MfaForm api={api} onConfirmed={() => session.refresh()} />;
    case 'terms_required':
      if (access.terms) return <TermsAcceptance terms={access.terms} {...acceptance} />;
      break;
    case 'ready':
      return <FeedbackState kind="loading">Abrindo seu Workspace…</FeedbackState>;
  }
  return <CodeForm api={api} onConfirmed={() => session.refresh()} />;
}

export function AccessFlow({
  api,
  session,
  returnTo,
}: {
  api: HostedAccessApi;
  session: SessionController;
  returnTo: string;
}) {
  const { state, access } = useAccessFlow(session, returnTo);
  const acceptance = useTermsAcceptance(api, session, access);
  return (
    <main className="tw:grid tw:min-h-screen tw:place-items-center tw:bg-ivory tw:p-6 tw:text-body tw:text-copy tw:mobile:p-4">
      <section
        className="tw:box-border tw:w-full tw:max-w-2xl tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-6 tw:mobile:p-4"
        aria-labelledby="access-title"
        aria-busy={acceptance.busy || state.phase === 'loading'}
      >
        <p className="tw:mb-6 tw:font-bold tw:tracking-widest tw:text-brand">CALI · WORKSPACE</p>
        <h1 id="access-title" className="tw:text-section tw:font-bold tw:text-brand">
          {accessTitle(access?.status)}
        </h1>
        <AccessStep
          api={api}
          session={session}
          state={state}
          access={access}
          acceptance={acceptance}
        />
        {acceptance.message && <p role="alert">{acceptance.message}</p>}
        {access?.profile && (
          <div className="tw:mt-6">
            <Button variant="secondary" onClick={() => void session.signOut()}>
              Sair
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}
