import { WorkspaceCatalogPage } from '../../../components/workspace/WorkspaceCatalogPage';
import { NoticeCatalogList } from '../../../components/notices/NoticeCatalogList';

export function AdminNoticesPage() {
  return (
    <WorkspaceCatalogPage
      module="notices"
      renderResults={(scope) => <NoticeCatalogList {...scope} role="admin" />}
    />
  );
}
