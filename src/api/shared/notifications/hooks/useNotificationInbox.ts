import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type NotificationsService } from '../schemas';

export function useNotificationInbox(service: NotificationsService, actor: string) {
  const cache = useQueryClient();
  const queryKey = ['notification-inbox', actor] as const;
  const inbox = useQuery({
    queryKey,
    queryFn: ({ signal }) => service.list(signal),
  });
  const mark = useMutation({
    mutationFn: (id: string | null) => service.markRead(id),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey });
    },
  });
  return { inbox, mark };
}
