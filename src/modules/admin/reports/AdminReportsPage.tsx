import { Fragment } from 'react';
import { useRouteContext } from '@tanstack/react-router';
import { WorkspaceCatalogPage } from '../../../components/workspace/WorkspaceCatalogPage';
import { CreateReportDraft } from '../../../components/workspace/CatalogActions';
import { ReportReadiness } from '../../../components/reports/ReportPrivacyActions';
import { AdminReportWorkspace } from './components/AdminReportWorkspace';
import { PartnerReportReviewQueue } from './components/PartnerReportReviewQueue';

export function AdminReportsPage() {
  const { partnerReportDrafts } = useRouteContext({ from: '__root__' });
  return (
    <WorkspaceCatalogPage
      module="reports"
      renderCompanyActions={({ company, actor }) => (
        <Fragment key={company}>
          {partnerReportDrafts && (
            <PartnerReportReviewQueue
              service={partnerReportDrafts}
              company={company}
              actor={actor}
            />
          )}
          <CreateReportDraft company={company} actor={actor} />
          <ReportReadiness company={company} actor={actor} />
        </Fragment>
      )}
      renderResults={({ company, actor, data, search, update }) => (
        <AdminReportWorkspace
          company={company}
          actor={actor}
          data={data}
          report={search.report}
          page={search.page}
          select={(id) => update({ report: id })}
          changePage={(page) => update({ page, report: undefined })}
        />
      )}
    />
  );
}
