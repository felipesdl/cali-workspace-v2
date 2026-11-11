import { Link, useRouteContext } from '@tanstack/react-router';
import { workspaceRole } from '../../api/access/schemas';
import { isPilotCompany } from '../../api/admin/companies/onboarding';
import { type WorkspaceNotification } from '../../api/shared/notifications/schemas';
import { workspaceSearch } from '../../api/shared/workspace/schemas';

export type NotificationRecipient = {
  id: string;
  role: typeof workspaceRole.Admin | typeof workspaceRole.Client;
  company_id: string | null;
};

const destinationClass = 'tw:font-semibold tw:text-brand tw:underline tw:underline-offset-2';

export function NotificationDestination({
  item,
  recipient,
  close,
}: {
  item: WorkspaceNotification;
  recipient: NotificationRecipient;
  close: () => void;
}) {
  const { domainOperations, projectWorkspace } = useRouteContext({ from: '__root__' });
  const admin = recipient.role === workspaceRole.Admin;
  const company = item.companyId ?? undefined;
  if (!projectWorkspace || !item.entityId || !isPilotCompany(company)) return null;
  if (!admin && company !== recipient.company_id) return null;

  const companyId = admin ? company : undefined;
  switch (item.entityType) {
    case 'account_record':
      if (!domainOperations) return null;
      return (
        <Link
          to={admin ? '/admin/registros' : '/cliente/registros'}
          search={workspaceSearch.parse({ companyId, record: item.entityId })}
          className={destinationClass}
          onClick={close}
        >
          Abrir ocorrência
        </Link>
      );
    case 'project':
      return (
        <Link
          to={admin ? '/admin/projetos' : '/cliente/entregaveis'}
          search={workspaceSearch.parse({
            companyId,
            project: item.entityId,
            projectView: 'roadmap',
          })}
          className={destinationClass}
          onClick={close}
        >
          Abrir projeto
        </Link>
      );
    case 'notice':
      return (
        <Link
          to={admin ? '/admin/avisos' : '/cliente/avisos'}
          search={workspaceSearch.parse({ companyId, aviso: item.entityId })}
          className={destinationClass}
          onClick={close}
        >
          Abrir comunicado
        </Link>
      );
    default:
      return null;
  }
}
