import { Link } from '@tanstack/react-router';
import { Menu, Search, ShieldCheck, X } from 'lucide-react';
import { Fragment, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import oakMark from '../assets/brand/cali-oak-mark-light.svg';
import { Field } from '../components/ds/field/Field';
import { Input } from '../components/ds/field/Controls';
import { type WorkspaceModuleLink } from './workspace-navigation';
import { WorkspaceRailGroup } from './WorkspaceRailGroup';
import '../styles/workspace-frame.css';

const searchKey = (value: string) =>
  value.trim().normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');

export function WorkspaceFrame({
  title,
  area,
  navigation,
  modules,
  shortcutLabels,
  actions,
  headingDescription,
  headingAction,
  children,
}: {
  title: string;
  area?: string;
  navigation?: ReactNode;
  modules?: readonly WorkspaceModuleLink[];
  shortcutLabels?: readonly WorkspaceModuleLink['label'][];
  actions?: ReactNode;
  headingDescription?: string;
  headingAction?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState<'menu' | 'search' | null>(null);
  const [query, setQuery] = useState('');
  const menuOpen = open === 'menu';
  const hasNavigation = Boolean(navigation || modules?.length);
  const normalizedQuery = searchKey(query);
  const shortcuts = !menuOpen
    ? shortcutLabels?.flatMap((label) => modules?.filter((module) => module.label === label) ?? [])
    : undefined;
  const visibleModules = modules?.filter(
    (module) => !shortcuts?.includes(module) && searchKey(module.label).includes(normalizedQuery),
  );
  const menuButton = useRef<HTMLButtonElement>(null);
  const searchButton = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [title]);
  useEffect(() => {
    if (open) searchInput.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!modules?.length) return;
    const openSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(window.matchMedia?.('(max-width: 850px)').matches ? 'menu' : 'search');
      }
    };
    window.addEventListener('keydown', openSearch);
    return () => window.removeEventListener('keydown', openSearch);
  }, [modules?.length]);

  const closeNavigation = (restoreFocus = true) => {
    setOpen(null);
    setQuery('');
    if (restoreFocus && open === 'search')
      requestAnimationFrame(() => searchButton.current?.focus());
    if (restoreFocus && open === 'menu') menuButton.current?.focus();
  };
  const selectDestination = (event: MouseEvent) => {
    if (
      open &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey &&
      event.target instanceof Element &&
      event.target.closest('a[href], button')
    ) {
      closeNavigation(false);
    }
  };

  return (
    <div
      className={`workspace-frame tw:min-h-screen tw:bg-ivory tw:text-copy ${
        hasNavigation ? 'workspace-frame-with-nav' : ''
      }`}
      data-menu-open={menuOpen}
      onKeyDown={(event) => {
        if (open && event.key === 'Escape' && !event.defaultPrevented) {
          event.preventDefault();
          closeNavigation();
        }
      }}
    >
      <a
        className="tw:sr-only tw:focus:not-sr-only tw:focus:fixed tw:focus:top-2 tw:focus:left-2 tw:focus:z-10 tw:focus:rounded-control tw:focus:bg-panel tw:focus:p-3 tw:focus:text-brand"
        href="#workspace-content"
      >
        Ir ao conteúdo
      </a>
      <header className="workspace-topbar">
        {hasNavigation && (
          <button
            ref={menuButton}
            type="button"
            className="workspace-mobile-menu"
            aria-label="Menu principal"
            aria-controls="workspace-navigation"
            aria-expanded={menuOpen}
            onClick={() => (menuOpen ? closeNavigation() : setOpen('menu'))}
          >
            {menuOpen ? <X aria-hidden="true" size={19} /> : <Menu aria-hidden="true" size={19} />}
          </button>
        )}
        <span className="workspace-label">
          CALI <span>WORKSPACE</span>
        </span>
        <div className="workspace-top-actions">
          {Boolean(shortcuts?.length) && (
            <div
              className="workspace-quick-links tw:shrink-0 tw:gap-2"
              aria-label="Atalhos do Workspace"
            >
              {shortcuts?.map(({ label, element }) => (
                <Fragment key={label}>{element}</Fragment>
              ))}
            </div>
          )}
          {Boolean(modules?.length) && (
            <div
              className="workspace-search"
              onBlur={(event) => {
                if (open === 'search' && !event.currentTarget.contains(event.relatedTarget))
                  closeNavigation(false);
              }}
            >
              <button
                ref={searchButton}
                type="button"
                className="workspace-search-control"
                hidden={open === 'search'}
                aria-keyshortcuts="Control+K Meta+K"
                onClick={() => setOpen('search')}
              >
                <Search aria-hidden="true" size={15} /> Buscar no Workspace{' '}
                <kbd aria-hidden="true">⌘ K</kbd>
              </button>
              {open === 'search' && (
                <>
                  <label className="workspace-search-control">
                    <Search aria-hidden="true" size={15} />
                    <input
                      ref={searchInput}
                      type="search"
                      aria-label="Buscar módulo"
                      placeholder="Buscar no Workspace"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter')
                          event.currentTarget
                            .closest('.workspace-search')
                            ?.querySelector<HTMLAnchorElement>('a[href]')
                            ?.click();
                      }}
                    />
                  </label>
                  <nav
                    className="workspace-search-results"
                    aria-label="Resultados da busca"
                    onClick={selectDestination}
                  >
                    {modules
                      ?.filter(({ label }) => searchKey(label).includes(normalizedQuery))
                      .map(({ label, element }) => (
                        <Fragment key={label}>{element}</Fragment>
                      ))}
                    {!modules?.some(({ label }) => searchKey(label).includes(normalizedQuery)) && (
                      <p role="status">Nenhum módulo encontrado.</p>
                    )}
                  </nav>
                </>
              )}
            </div>
          )}
          {actions}
        </div>
      </header>
      {hasNavigation && (
        <aside className="workspace-rail tw:text-panel">
          <div className="workspace-rail-brand tw:flex tw:h-15 tw:items-center tw:justify-center">
            <img src={oakMark} width={24} height={24} alt="" />
          </div>
          <nav
            id="workspace-navigation"
            aria-label="Navegação principal"
            className="workspace-rail-nav"
            onClick={selectDestination}
          >
            {menuOpen && modules && (
              <div className="tw:rounded-control tw:bg-panel tw:p-2 tw:text-copy">
                <Field id="workspace-module-search" label="Buscar módulo">
                  <Input
                    ref={searchInput}
                    id="workspace-module-search"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return;
                      event.preventDefault();
                      event.currentTarget
                        .closest('nav')
                        ?.querySelector<HTMLAnchorElement>('a[href]')
                        ?.click();
                    }}
                  />
                </Field>
                <p className="tw:mt-2 tw:mb-0 tw:text-caption" role="status">
                  {visibleModules?.length
                    ? `${visibleModules.length} ${visibleModules.length === 1 ? 'módulo encontrado' : 'módulos encontrados'}`
                    : 'Nenhum módulo encontrado.'}
                </p>
              </div>
            )}
            {navigation}
            {visibleModules?.map((module) =>
              module.sections?.length ? (
                <WorkspaceRailGroup
                  key={`${module.label}:${menuOpen}`}
                  module={module}
                  sections={module.sections}
                  mobile={menuOpen}
                />
              ) : (
                <Fragment key={module.label}>{module.element}</Fragment>
              ),
            )}
          </nav>
          <div className="workspace-rail-footer">
            <Link
              to="/privacidade"
              aria-label="Política de privacidade"
              title="Política de privacidade"
            >
              <ShieldCheck size={17} strokeWidth={1.6} aria-hidden="true" />
            </Link>
          </div>
        </aside>
      )}
      <main id="workspace-content" tabIndex={-1} className="workspace-content">
        <div className="tw:mb-6 tw:flex tw:min-w-0 tw:flex-wrap tw:items-center tw:justify-between tw:gap-3">
          <div className="tw:min-w-0">
            {area && <p className="workspace-eyebrow tw:mt-0 tw:mb-1">{area}</p>}
            <h1
              ref={heading}
              tabIndex={-1}
              id="workspace-title"
              className="workspace-page-title tw:m-0 tw:w-fit tw:font-bold tw:text-copy"
            >
              {title}
              <span aria-hidden="true" className="tw:text-gold">
                .
              </span>
            </h1>
            {headingDescription && (
              <p className="tw:mt-1 tw:mb-0 tw:text-caption tw:text-muted-copy">
                {headingDescription}
              </p>
            )}
          </div>
          {headingAction}
        </div>
        {children}
      </main>
    </div>
  );
}
