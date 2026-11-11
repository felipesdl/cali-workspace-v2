import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from '../button/Button';
import './dialog.css';

export function Dialog({
  title,
  layout = 'modal',
  pending = false,
  onDismiss,
  children,
}: {
  title: string;
  layout?: 'modal' | 'drawer';
  pending?: boolean;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const heading = useId();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else {
      dialog.open = true;
      dialog.querySelector<HTMLElement>('button')?.focus();
    }
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      if (
        previous instanceof HTMLElement &&
        previous.isConnected &&
        (document.activeElement === document.body || dialog.contains(document.activeElement))
      ) {
        previous.focus();
      }
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="cali-dialog"
      data-layout={layout}
      aria-labelledby={heading}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onDismiss();
      }}
      onClick={(event) => {
        if (pending || event.target !== event.currentTarget) return;
        const { top, right, bottom, left } = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < left ||
          event.clientX > right ||
          event.clientY < top ||
          event.clientY > bottom
        ) {
          onDismiss();
        }
      }}
    >
      <header className="cali-dialog-heading">
        <h2 id={heading}>{title}</h2>
        <Button
          variant="secondary"
          className="tw:size-9 tw:min-h-9! tw:shrink-0 tw:p-0!"
          aria-label="Fechar"
          disabled={pending}
          onClick={onDismiss}
        >
          <X size={17} className="tw:shrink-0" aria-hidden="true" />
        </Button>
      </header>
      <div className="cali-dialog-body">{children}</div>
    </dialog>
  );
}
