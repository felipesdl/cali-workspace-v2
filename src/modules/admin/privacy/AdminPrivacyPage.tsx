import { Fragment } from 'react';
import {
  DataLifecycleOverview,
  PrivacyActions,
} from '../../../components/reports/ReportPrivacyActions';
import { getRouteApi, useRouteContext } from '@tanstack/react-router';
import { useProjectWorkspaceScope } from '../../../components/workspace/useProjectWorkspaceScope';
import { CompanySelect } from '../../../components/workspace/WorkspaceCompanySelect';

const adminPrivacy = getRouteApi('/admin/privacidade');

export function AdminPrivacyPage() {
  const search = adminPrivacy.useSearch();
  const navigate = adminPrivacy.useNavigate();
  const { companyId, actor, admin } = useProjectWorkspaceScope(search);
  const { domainOperations } = useRouteContext({ from: '__root__' });
  if (!admin || !domainOperations) return null;
  return (
    <div className="tw:grid tw:gap-4">
      <CompanySelect
        search={search}
        update={(change) => void navigate({ search: { ...search, ...change } })}
      />
      {companyId ? (
        <Fragment key={companyId}>
          <DataLifecycleOverview company={companyId} actor={actor} />
          <PrivacyActions company={companyId} actor={actor} admin />
        </Fragment>
      ) : (
        <p>Selecione uma empresa.</p>
      )}
    </div>
  );
}
