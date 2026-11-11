import { OwnProfilePage } from '../../../components/account/OwnProfilePage';
import { AccountHelp } from '../../../components/account/AccountHelp';

export function AdminOwnProfilePage() {
  return (
    <div className="tw:grid tw:gap-4">
      <OwnProfilePage />
      <AccountHelp admin />
    </div>
  );
}
