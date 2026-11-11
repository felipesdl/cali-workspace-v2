import { WorkspaceCatalogPage } from '../../../components/workspace/WorkspaceCatalogPage';
import { AgendaList } from '../../../components/agenda/AgendaList';

export function ClientAgendaPage() {
  return (
    <WorkspaceCatalogPage module="calendar" renderResults={(scope) => <AgendaList {...scope} />} />
  );
}
