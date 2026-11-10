import { z } from 'zod';

const notification = z.object({
  id: z.uuid(),
  title: z.string(),
  body: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  readAt: z.iso.datetime({ offset: true }).nullable(),
  companyId: z.uuid().nullable(),
  entityType: z.string().nullable(),
  entityId: z.uuid().nullable(),
});
export const notificationCount = z.number().int().nonnegative();
export const notificationInbox = z.object({
  unread: notificationCount,
  entries: z.array(notification).max(25),
});
export type WorkspaceNotification = z.infer<typeof notification>;

export type NotificationsService = {
  list(signal: AbortSignal): Promise<z.infer<typeof notificationInbox>>;
  markRead(notificationId: string | null): Promise<number>;
};
