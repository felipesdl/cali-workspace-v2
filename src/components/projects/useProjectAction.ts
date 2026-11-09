import { useRouteContext } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { type ProjectAction } from '../../api/shared/workspace/operations';

export function useProjectAction(company: string, actor: string | undefined, project?: string) {
  const { projectOperations } = useRouteContext({ from: '__root__' });
  const cache = useQueryClient();
  if (!projectOperations) return null;
  return async (command: ProjectAction) => {
    try {
      return await projectOperations(company, command);
    } finally {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['projects', actor, company] }),
        cache.invalidateQueries({ queryKey: ['project-journal', actor, company, project] }),
        cache.invalidateQueries({ queryKey: ['project', actor, company, project] }),
        cache.invalidateQueries({ queryKey: ['phase4-delivery-pdf', actor, company, project] }),
      ]);
    }
  };
}
