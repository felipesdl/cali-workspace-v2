import { type WorkspaceSearch } from '../../api/shared/workspace/schemas';

export const panel =
  'tw:min-w-0 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4';

export type Props = { search: WorkspaceSearch; update: (change: Partial<WorkspaceSearch>) => void };
