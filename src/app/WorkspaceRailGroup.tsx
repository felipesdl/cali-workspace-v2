import { CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { cloneElement, useId, useRef, useState } from 'react';
import { type WorkspaceModuleLink, type WorkspaceModuleSection } from './workspace-navigation';

export function WorkspaceRailGroup({
  module,
  sections,
  mobile,
}: {
  module: WorkspaceModuleLink;
  sections: readonly WorkspaceModuleSection[];
  mobile: boolean;
}) {
  const [open, setOpen] = useState(false);
  const group = useRef<HTMLDivElement>(null);
  const disclosure = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const headingId = useId();

  return (
    <div
      ref={group}
      className="workspace-rail-group"
      onPointerEnter={(event) => {
        if (!mobile && event.pointerType === 'mouse') setOpen(true);
      }}
      onPointerLeave={() => {
        if (!mobile && !group.current?.contains(document.activeElement)) setOpen(false);
      }}
      onFocus={(event) => {
        if (!mobile && !event.currentTarget.contains(event.relatedTarget)) setOpen(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return;
        event.preventDefault();
        const trigger = mobile ? disclosure.current : group.current?.querySelector('a');
        trigger?.focus();
        setOpen(false);
      }}
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest('a[href]')) setOpen(false);
      }}
    >
      {cloneElement(module.element, {
        'aria-expanded': mobile ? undefined : open,
        'aria-controls': mobile || !open ? undefined : panelId,
      })}
      {mobile && (
        <button
          ref={disclosure}
          className="workspace-rail-disclosure"
          type="button"
          aria-label={`Áreas de ${module.label}`}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={(event) => {
            event.stopPropagation();
            setOpen((value) => !value);
          }}
        >
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      )}
      {open && (
        <section id={panelId} aria-labelledby={headingId} className="workspace-rail-flyout">
          <header>
            <strong id={headingId}>{module.label}</strong>
            <small>Áreas do módulo</small>
          </header>
          {sections.map(({ label, active, element }) =>
            cloneElement(
              element,
              {
                key: label,
                className: 'workspace-rail-flyout-link',
                'aria-current': active ? 'page' : undefined,
              },
              <>
                <span>{label}</span>
                {active ? (
                  <CheckCircle2 size={14} aria-hidden="true" />
                ) : (
                  <ChevronRight size={13} aria-hidden="true" />
                )}
              </>,
            ),
          )}
        </section>
      )}
    </div>
  );
}
