import { WorkspacePagination } from './WorkspacePagination';
import { type Props } from './workspace-presentation';

export function Pages({ total, search, update }: Props & { total: number }) {
  return (
    <WorkspacePagination total={total} page={search.page} change={(page) => update({ page })} />
  );
}
