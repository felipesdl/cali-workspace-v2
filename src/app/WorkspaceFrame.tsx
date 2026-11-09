import { Menu, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import oakMark from '../assets/brand/cali-oak-mark-light.svg';
import { Button } from '../components/ds/button/Button';
import '../styles/workspace-frame.css';

export function WorkspaceFrame({
  title,
  navigation,
  actions,
  children,
}: {
  title: string;
  navigation?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [title]);

  const closeMenu = () => {
    setMenuOpen(false);
    menuButton.current?.focus();
  };

  return (
    <div
      className={`workspace-frame tw:min-h-screen tw:bg-ivory tw:text-body tw:text-copy ${
        navigation
          ? 'tw:grid tw:grid-cols-[13rem_minmax(0,1fr)] tw:grid-rows-[auto_1fr] tw:compact:block'
          : ''
      }`}
      onKeyDown={(event) => {
        if (menuOpen && event.key === 'Escape' && !event.defaultPrevented) {
          event.preventDefault();
          closeMenu();
        }
      }}
    >
      <a
        className="tw:sr-only tw:focus:not-sr-only tw:focus:fixed tw:focus:top-2 tw:focus:left-2 tw:focus:z-10 tw:focus:rounded-control tw:focus:bg-panel tw:focus:p-3 tw:focus:text-brand"
        href="#workspace-content"
      >
        Ir ao conteúdo
      </a>
      <header className="tw:col-start-2 tw:row-start-1 tw:flex tw:min-h-15 tw:items-center tw:justify-between tw:gap-2 tw:border-b tw:border-border-default tw:bg-panel tw:px-6 tw:mobile:px-4">
        <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
          {navigation && (
            <div className="tw:hidden tw:compact:block">
              <Button
                ref={menuButton}
                variant="secondary"
                aria-label="Menu principal"
                aria-controls="workspace-navigation"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                {menuOpen ? (
                  <X aria-hidden="true" size={18} />
                ) : (
                  <Menu aria-hidden="true" size={18} />
                )}
              </Button>
            </div>
          )}
          <span className="tw:text-caption tw:font-bold tw:tracking-widest tw:text-brand">
            CALI <span className="tw:font-medium tw:text-muted-copy">WORKSPACE</span>
          </span>
        </div>
        {actions}
      </header>
      {navigation && (
        <aside
          className={`tw:sticky tw:top-0 tw:col-start-1 tw:row-span-2 tw:row-start-1 tw:h-dvh tw:overflow-y-auto tw:bg-brand tw:text-panel tw:compact:static tw:compact:h-auto tw:compact:max-h-[65dvh] ${
            menuOpen ? '' : 'tw:compact:hidden'
          }`}
        >
          <div className="tw:flex tw:h-15 tw:items-center tw:px-4 tw:compact:hidden">
            <img src={oakMark} width={28} height={28} alt="" />
          </div>
          <nav
            id="workspace-navigation"
            aria-label="Navegação principal"
            className="tw:grid tw:gap-1 tw:px-2 tw:py-3"
            onClick={(event) => {
              if (
                menuOpen &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.shiftKey &&
                !event.altKey &&
                event.target instanceof Element &&
                event.target.closest('a[href], button')
              ) {
                closeMenu();
              }
            }}
          >
            {navigation}
          </nav>
        </aside>
      )}
      <main
        id="workspace-content"
        tabIndex={-1}
        className="tw:col-start-2 tw:row-start-2 tw:mx-auto tw:box-border tw:w-full tw:max-w-6xl tw:min-w-0 tw:p-6 tw:mobile:p-4"
      >
        <h1
          ref={heading}
          tabIndex={-1}
          id="workspace-title"
          className="tw:mt-0 tw:mb-6 tw:w-fit tw:text-section tw:font-bold tw:text-brand"
        >
          {title}
        </h1>
        {children}
      </main>
    </div>
  );
}
