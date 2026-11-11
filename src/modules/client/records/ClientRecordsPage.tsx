import { WorkspaceCatalogPage } from '../../../components/workspace/WorkspaceCatalogPage';
import { RecordCatalogList } from '../../../components/records/RecordCatalogList';

export function ClientRecordsPage() {
  return (
    <WorkspaceCatalogPage
      module="records"
      renderResults={(scope) => <RecordCatalogList {...scope} role="client" />}
    />
  );
}
