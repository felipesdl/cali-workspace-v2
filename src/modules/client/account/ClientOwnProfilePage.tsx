import { OwnProfilePage } from '../../../components/account/OwnProfilePage';
import { AccountHelp } from '../../../components/account/AccountHelp';
import { PrivacyActions } from '../../../components/reports/ReportPrivacyActions';
import { useWorkspaceSession } from '../../../api/access/hooks/useWorkspaceSession';
import { isPilotCompany } from '../../../api/admin/companies/onboarding';
import { useRouteContext } from '@tanstack/react-router';

export function ClientOwnProfilePage() {
  const session = useWorkspaceSession();
  const { domainOperations } = useRouteContext({ from: '__root__' });
  const profile =
    session.phase === 'resolved' && session.access.status === 'ready'
      ? session.access.profile
      : null;
  const company = profile?.company_id;
  return (
    <div className="tw:grid tw:gap-4">
      <OwnProfilePage />
      <AccountHelp>
        {domainOperations && company && isPilotCompany(company) && (
          <PrivacyActions key={company} company={company} actor={profile.id} />
        )}
      </AccountHelp>
    </div>
  );
}
