import { type WorkspaceClient } from '../../supabase';
import { notificationCount, notificationInbox, type NotificationsService } from './schemas';

export function createNotificationsService(client: WorkspaceClient): NotificationsService {
  return {
    async list(signal: AbortSignal) {
      const { data, error } = await client.rpc('v2_list_my_notifications').abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar as notificações.');
      return notificationInbox.parse(data);
    },
    async markRead(notificationId: string | null) {
      const { data, error } = await client.rpc('v2_mark_my_notifications_read', {
        p_notification_id: notificationId,
      });
      if (error) throw new Error('Não foi possível registrar a leitura.');
      return notificationCount.parse(data);
    },
  };
}
