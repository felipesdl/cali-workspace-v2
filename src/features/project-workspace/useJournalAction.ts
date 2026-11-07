import { useRouteContext } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  type CollaborationAction,
  type ProjectJournalScope,
} from '../../api/modules/project-workspace/project-journal';

export function useJournalAction(scope: ProjectJournalScope, delivery: string, enabled: boolean) {
  const { projectJournal } = useRouteContext({ from: '__root__' });
  const cache = useQueryClient();
  const operate = projectJournal?.operate;
  if (!operate || !enabled) return null;
  return async (command: CollaborationAction, requestId: string) => {
    try {
      return await operate(scope, delivery, requestId, command);
    } finally {
      await Promise.all([
        cache.invalidateQueries({
          queryKey: ['project-journal', scope.actor, scope.company, scope.project],
        }),
        cache.invalidateQueries({
          queryKey: ['project', scope.actor, scope.company, scope.project],
        }),
        cache.invalidateQueries({ queryKey: ['projects', scope.actor, scope.company] }),
      ]);
    }
  };
}
export type JournalSubmit = NonNullable<ReturnType<typeof useJournalAction>>;
