import { Bell, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { type NotificationsService } from '../../api/modules/notifications/schemas';
import { Button } from '../../components/ds/button/Button';
import { FeedbackMessage } from '../../components/ds/feedback/FeedbackMessage';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { formatServerInstant } from '../../lib/dates';
import { NotificationDestination, type NotificationRecipient } from './NotificationDestination';
import { useNotificationInbox } from '../../api/modules/notifications/hooks/useNotificationInbox';

export function NotificationInbox({
  service,
  recipient,
}: {
  service: NotificationsService;
  recipient: NotificationRecipient;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const receipt = useRef<HTMLParagraphElement>(null);
  const { inbox, mark } = useNotificationInbox(service, recipient.id);
  useEffect(() => {
    if (open) receipt.current?.focus();
  }, [open, mark.status]);
  const snapshot = inbox.isSuccess ? inbox.data : undefined;
  const unread = snapshot?.unread ?? 0;
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div
      onKeyDown={(event) => {
        if (open && event.key === 'Escape') {
          event.preventDefault();
          close();
        }
      }}
    >
      <Button
        ref={trigger}
        variant="secondary"
        aria-label={unread ? `Notificações, ${unread} não lidas` : 'Notificações'}
        aria-expanded={open}
        aria-controls={open ? 'workspace-notifications' : undefined}
        className="tw:min-w-control tw:px-2"
        onClick={() => {
          if (open) {
            close();
            return;
          }
          mark.reset();
          setOpen(true);
          void inbox.refetch();
        }}
      >
        <Bell size={18} aria-hidden="true" />
        {unread > 0 && (
          <span aria-hidden="true" className="tw:text-caption tw:font-semibold">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Button>
      {open && (
        <section
          id="workspace-notifications"
          aria-labelledby="workspace-notifications-title"
          className="tw:absolute tw:end-0 tw:top-[calc(100%+0.5rem)] tw:z-30 tw:box-border tw:grid tw:max-h-[calc(100dvh-5rem)] tw:w-[min(28rem,calc(100vw-2rem))] tw:gap-3 tw:overflow-y-auto tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-3 tw:text-copy tw:shadow-lg"
        >
          <header className="tw:flex tw:items-center tw:justify-between tw:gap-2">
            <h2 id="workspace-notifications-title" className="tw:m-0 tw:text-section tw:text-brand">
              Notificações
            </h2>
            <Button
              variant="secondary"
              aria-label="Fechar notificações"
              className="tw:min-w-control tw:px-2"
              onClick={close}
            >
              <X size={18} aria-hidden="true" />
            </Button>
          </header>
          {inbox.isError && (
            <FeedbackState kind="error" onRetry={() => void inbox.refetch()}>
              Não foi possível consultar as notificações.
            </FeedbackState>
          )}
          {inbox.isPending && (
            <FeedbackState kind="loading">Carregando notificações…</FeedbackState>
          )}
          {snapshot && (
            <>
              {snapshot.entries.length === 0 && (
                <FeedbackState kind="empty">Nenhuma notificação.</FeedbackState>
              )}
              {snapshot.entries.length > 0 && (
                <>
                  <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
                    <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
                      {unread} {unread === 1 ? 'não lida' : 'não lidas'}
                    </p>
                    <Button
                      variant="secondary"
                      pending={mark.isPending && mark.variables === null}
                      disabled={unread === 0 || mark.isPending}
                      onClick={() => mark.mutate(null)}
                    >
                      Marcar todas como lidas
                    </Button>
                  </div>
                  {mark.isError && (
                    <FeedbackMessage ref={receipt} tabIndex={-1} tone="error">
                      Não foi possível registrar a leitura. Tente novamente.
                    </FeedbackMessage>
                  )}
                  {mark.isSuccess && (
                    <FeedbackMessage ref={receipt} tabIndex={-1} tone="success">
                      {mark.data > 0
                        ? 'Leitura registrada.'
                        : 'Nenhuma leitura nova foi registrada.'}
                    </FeedbackMessage>
                  )}
                  <ul className="tw:m-0 tw:grid tw:list-none tw:gap-2 tw:p-0">
                    {snapshot.entries.map((item) => (
                      <li
                        key={item.id}
                        className="tw:grid tw:min-w-0 tw:gap-2 tw:rounded-control tw:border tw:border-border-default tw:p-3 tw:wrap-anywhere"
                      >
                        <div className="tw:grid tw:gap-1">
                          <strong>{item.title}</strong>
                          <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
                            {formatServerInstant(item.createdAt)} ·{' '}
                            {item.readAt ? 'Lida' : 'Não lida'}
                          </p>
                        </div>
                        {item.body && <p className="tw:m-0">{item.body}</p>}
                        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
                          <NotificationDestination
                            item={item}
                            recipient={recipient}
                            close={close}
                          />
                          {!item.readAt && (
                            <Button
                              variant="secondary"
                              pending={mark.isPending && mark.variables === item.id}
                              disabled={mark.isPending}
                              aria-label={`Marcar como lida: ${item.title}`}
                              onClick={() => mark.mutate(item.id)}
                            >
                              Marcar como lida
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
                    Até 25 notificações recentes.
                  </p>
                </>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
