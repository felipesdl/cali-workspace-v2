import { Download } from 'lucide-react';
import { FileDownload } from '../../../../components/documents/FileDownload';
import { formatOverviewMonth } from '../../overview/components/overview-format';
import { type AdminReadService } from '../../../../api/admin/workspace/admin-read';

export function SatisfactionExport({
  company,
  companyName,
  month,
  service,
}: {
  company: string;
  companyName: string;
  month: string | null;
  service: AdminReadService;
}) {
  return (
    <FileDownload
      label="Exportar satisfação em PDF"
      buttonContent={
        <>
          <Download size={16} aria-hidden="true" /> Exportar satisfação em PDF
        </>
      }
      download={async (signal) => {
        const [{ overviewPdf }, report, requests] = await Promise.all([
          import('../../overview/components/overview-pdf'),
          service.satisfactionPeriod(company, month, 1, signal),
          service.satisfactionRequests(company, month, 1, signal),
        ]);
        const sections = [
          {
            title: 'Distribuição das avaliações',
            rows: report.distribution.map(
              ({ score, total }) => [`Nota ${score}`, String(total)] as const,
            ),
          },
          {
            title: 'Solicitações de avaliação',
            rows: requests
              ? ([
                  ['Respondidas', String(requests.answered)],
                  ['Aguardando resposta', String(requests.waiting)],
                  ['Sem resposta', String(requests.unanswered)],
                ] as const)
              : ([['Solicitações', 'Indisponível']] as const),
          },
          {
            title: 'Tendência mensal',
            rows: report.trend.map(
              (row) =>
                [
                  formatOverviewMonth(row.month),
                  `Média ${row.average.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}/5 · ${row.total} avaliações · ${row.attention} notas 1–3 · ${row.positive} notas 4–5`,
                ] as const,
            ),
          },
        ];
        const periodLabel = month ? formatOverviewMonth(month) : 'Todo o histórico';
        const blob = await overviewPdf(
          companyName,
          periodLabel,
          {
            metrics: [
              [
                'Índice médio',
                report.average === null
                  ? '—'
                  : `${report.average.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}/5`,
              ],
              ['Avaliações', String(report.total)],
            ],
            sections,
          },
          'Satisfação',
        );
        return { blob, fileName: `cali-satisfacao-${month?.slice(0, 7) ?? 'historico'}.pdf` };
      }}
    />
  );
}
