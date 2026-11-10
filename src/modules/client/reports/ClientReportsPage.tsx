import { WorkspaceCatalogPage } from '../../../components/workspace/WorkspaceCatalogPage';
import { ClientReportReading } from './components/ClientReportReading';

export function ClientReportsPage() {
  return (
    <WorkspaceCatalogPage
      module="reports"
      renderResults={({ company, actor, data, search, update }) => (
        <ClientReportReading
          company={company}
          actor={actor}
          data={data}
          report={search.report}
          showList={search.reportView === 'list'}
          page={search.page}
          select={(id) => update({ report: id, reportView: undefined })}
          changePage={(page) => update({ page, report: undefined })}
          toggleList={(show) => update({ reportView: show ? 'list' : undefined })}
        />
      )}
    />
  );
}
