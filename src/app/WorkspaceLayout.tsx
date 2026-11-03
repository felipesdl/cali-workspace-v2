import { useEffect, useRef, type ReactNode } from 'react';
import { Link, useRouteContext } from '@tanstack/react-router';
import { Button } from '../components/ds/button/Button';
import { useWorkspaceSession } from '../api/modules/access/hooks/useWorkspaceSession';

export function WorkspaceLayout({
  title,
  children,
  navigation,
}: {
  title: string;
  children: ReactNode;
  navigation?: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [title]);
  const { session } = useRouteContext({ from: '__root__' });
  const state = useWorkspaceSession();
  const admin = state.phase === 'resolved' && state.access.profile?.role === 'admin';
  return (
    <div className="tw:min-h-screen tw:bg-ivory tw:text-body tw:text-copy">
      <a className="tw:sr-only tw:focus:not-sr-only" href="#workspace-content">
        Ir ao conteúdo
      </a>
      <header className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-4 tw:border-b tw:border-border-default tw:bg-panel tw:px-6 tw:py-4">
        <span className="tw:text-section tw:font-bold tw:tracking-widest tw:text-brand">
          CALI · WORKSPACE
        </span>
        <nav
          aria-label="Navegação principal"
          className="tw:flex tw:flex-wrap tw:items-center tw:gap-4"
        >
          {navigation}
          {admin && (
            <Link
              className="tw:text-brand tw:visited:text-brand tw:focus-visible:outline-2 tw:focus-visible:outline-offset-3 tw:focus-visible:outline-focus"
              to="/admin/clientes"
              search={{ q: '', status: 'all' }}
            >
              Empresas e acessos
            </Link>
          )}
          <Button variant="secondary" onClick={() => void session?.signOut()}>
            Sair
          </Button>
        </nav>
      </header>
      <main id="workspace-content" className="tw:mx-auto tw:max-w-6xl tw:p-6 tw:mobile:p-4">
        <h1
          ref={heading}
          tabIndex={-1}
          id="workspace-title"
          className="tw:mb-6 tw:text-section tw:font-bold tw:text-brand"
        >
          {title}
        </h1>
        {children}
      </main>
    </div>
  );
}
