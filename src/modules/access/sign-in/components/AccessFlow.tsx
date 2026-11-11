import { AccessShell } from './AccessShell';
import { FeedbackMessage } from '../../../../components/ds/feedback/FeedbackMessage';
import { useEffect, useRef, type ReactNode } from 'react';
import { type HostedAccessApi } from '../../../../api/access/api';
import { type SessionController, type SessionState } from '../../../../app/session/controller';
import { accessReasonMessages } from '../../../../app/session/access-reason';
import { type WorkspaceAccessState } from '../../../../api/access/session';
import { Button } from '../../../../components/ds/button/Button';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';
import { FormActions } from '../../../../components/ds/button/FormActions';
import { CodeForm } from './CodeForm';
import { MfaForm } from './MfaForm';
import { TermsAcceptance } from './TermsAcceptance';
import { useAccessFlow } from '../hooks/useAccessFlow';
import { useTermsAcceptance } from '../hooks/useTermsAcceptance';

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
  exitAction: ReactNode;
};
function AccessStep({ api, session, state, access, acceptance, exitAction }: AccessStepProps) {
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
        <>
          <FeedbackState kind="error">
            Seu acesso está indisponível. Entre em contato com a CALI.
          </FeedbackState>
          <FormActions className="tw:mt-3">{exitAction}</FormActions>
        </>
      );
    case 'mfa_required':
      return (
        <MfaForm
          api={api}
          exitAction={exitAction}
          onConfirmed={async () => {
            await session.refresh();
          }}
        />
      );
    case 'terms_required':
      if (access.terms)
        return <TermsAcceptance terms={access.terms} exitAction={exitAction} {...acceptance} />;
      break;
    case 'terms_unavailable':
      return (
        <>
          <FeedbackState kind="error">{accessReasonMessages.terms_unavailable}</FeedbackState>
          <FormActions className="tw:mt-3">
            <Button onClick={() => void session.refresh()}>Tentar novamente</Button>
            {exitAction}
          </FormActions>
        </>
      );
    case 'ready':
      return <FeedbackState kind="loading">Abrindo seu Workspace…</FeedbackState>;
  }
  return (
    <CodeForm
      branded
      api={api}
      exitAction={exitAction}
      onConfirmed={async () => {
        await session.refresh();
      }}
    />
  );
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
  const exitAction = (access?.profile || access?.status === 'blocked') && (
    <Button variant="secondary" onClick={() => void session.signOut()}>
      Sair
    </Button>
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const status = state.phase === 'signed_out' ? 'signed_out' : access?.status;
  useEffect(() => {
    if (status && status !== 'ready' && document.activeElement === document.body) {
      heading.current?.focus();
    }
  }, [status]);
  return (
    <AccessShell busy={acceptance.busy || state.phase === 'loading'}>
      {status !== 'signed_out' && (
        <h1 ref={heading} id="access-title" tabIndex={-1}>
          {accessTitle(status)}
        </h1>
      )}
      <AccessStep
        api={api}
        session={session}
        state={state}
        access={access}
        acceptance={acceptance}
        exitAction={exitAction}
      />
      {acceptance.message && (
        <FeedbackMessage tone="error" className="tw:mt-3">
          {acceptance.message}
        </FeedbackMessage>
      )}
    </AccessShell>
  );
}
