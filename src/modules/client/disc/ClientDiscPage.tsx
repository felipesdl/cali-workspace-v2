import { FeedbackState } from '../../../components/ds/feedback/FeedbackState';
import { ManagementReport } from '../../../components/disc/ManagementReport';
import { useDiscClient } from '../../../api/shared/disc/hooks';

export function ClientDiscPage() {
  const reports = useDiscClient();

  return (
    <div data-feature="disc-client" className="tw:grid tw:gap-5 tw:text-body tw:text-copy">
      <header className="tw:grid tw:gap-2">
        <p className="tw:m-0 tw:text-caption tw:font-semibold tw:tracking-wide tw:text-muted-copy tw:uppercase">
          Desenvolvimento de pessoas
        </p>
        <h2 className="tw:m-0 tw:text-section tw:font-semibold tw:text-brand">
          Perfil comportamental
        </h2>
        <p className="tw:m-0 tw:max-w-3xl tw:text-copy">
          Consulte a leitura coletiva liberada pela CALI para sua empresa.
        </p>
      </header>

      {!reports.available ? (
        <FeedbackState kind="empty">
          Esta consulta está disponível somente para acessos Cliente da empresa sintética habilitada
          no piloto.
        </FeedbackState>
      ) : reports.isPending ? (
        <FeedbackState kind="loading">Carregando relatórios liberados…</FeedbackState>
      ) : reports.isError ? (
        <FeedbackState kind="error" onRetry={() => void reports.refetch()}>
          Não foi possível carregar a leitura de gestão.
        </FeedbackState>
      ) : reports.data?.reports.length ? (
        <section className="tw:grid tw:gap-4" aria-label="Relatórios de gestão liberados">
          {reports.data.reports.map((report) => (
            <ManagementReport key={`${report.id}:${report.revision}`} report={report} />
          ))}
        </section>
      ) : (
        <FeedbackState kind="empty">
          A CALI ainda não liberou um relatório de gestão para sua empresa.
        </FeedbackState>
      )}
    </div>
  );
}
