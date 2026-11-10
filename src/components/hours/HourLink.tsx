import { Link, useRouteContext } from '@tanstack/react-router';
import { workspaceSearch } from '../../api/shared/workspace/schemas';

export function HourLink({
  company,
  delivery,
  task,
}: {
  company: string;
  delivery: string;
  task?: string;
}) {
  const { hourOperations } = useRouteContext({ from: '__root__' });
  if (!hourOperations) return null;
  return (
    <Link
      className="tw:text-brand tw:underline tw:focus-visible:outline-2 tw:focus-visible:outline-offset-3 tw:focus-visible:outline-focus"
      to="/admin/horas"
      search={workspaceSearch.parse({ companyId: company, delivery, task })}
    >
      {task ? 'Registrar horas na subtarefa' : 'Registrar horas no entregável'}
    </Link>
  );
}
