import { useEffect, useRef, type ReactNode } from 'react';
import { Link, useRouteContext } from '@tanstack/react-router';
import { workspaceRole } from '../../api/access/schemas';
import { useWorkspaceSession } from '../../api/access/hooks/useWorkspaceSession';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import '../../styles/workspace-frame.css';

export const recoveryLinkClass =
  'tw:justify-self-start tw:rounded-control tw:px-3 tw:py-2 tw:font-medium tw:text-brand tw:underline tw:underline-offset-4 tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-focus';

export function WorkspaceRecoveryLink() {
  const { session } = useRouteContext({ from: '__root__' });
  const state = useWorkspaceSession();
  useEffect(() => {
    void session?.resolve();
  }, [session]);

  if (state.phase === 'idle' || state.phase === 'loading') return null;
  const role =
    state.phase === 'resolved' && state.access.status === 'ready'
      ? state.access.profile?.role
      : undefined;
  if (role === workspaceRole.Admin) {
    return (
      <Link
        to="/admin/clientes"
        search={{ q: '', status: 'all' }}
        replace
        className={recoveryLinkClass}
      >
        Voltar ao início
      </Link>
    );
  }
  return (
    <Link
      to={role === workspaceRole.Client ? '/cliente' : '/'}
      replace
      className={recoveryLinkClass}
    >
      Voltar ao início
    </Link>
  );
}

export function RouteStatusPage({
  title,
  kind,
  message,
  children,
}: {
  title: string;
  kind: 'loading' | 'error' | 'empty';
  message: string;
  children?: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (kind !== 'loading') heading.current?.focus();
  }, [kind, title]);

  return (
    <main className="workspace-frame tw:box-border tw:grid tw:min-h-dvh tw:place-items-center tw:bg-ivory tw:p-4 tw:text-body tw:text-copy">
      <section
        aria-labelledby="route-status-title"
        className="tw:box-border tw:grid tw:w-full tw:max-w-lg tw:min-w-0 tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-6 tw:wrap-anywhere"
      >
        <h1
          id="route-status-title"
          ref={heading}
          tabIndex={-1}
          className="tw:m-0 tw:text-section tw:font-bold tw:text-brand"
        >
          {title}
        </h1>
        <FeedbackState kind={kind}>{message}</FeedbackState>
        {children}
      </section>
    </main>
  );
}
