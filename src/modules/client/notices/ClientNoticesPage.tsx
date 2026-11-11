import { WorkspaceCatalogPage } from '../../../components/workspace/WorkspaceCatalogPage';
import { NoticeCatalogList } from '../../../components/notices/NoticeCatalogList';

export function ClientNoticesPage() {
  return (
    <WorkspaceCatalogPage
      module="notices"
      renderResults={(scope) => <NoticeCatalogList {...scope} role="client" />}
    />
  );
}
