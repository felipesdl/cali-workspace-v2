import { FileDownload } from '../../../../components/documents/FileDownload';
import { Download } from 'lucide-react';
import { formatOverviewMonth } from './overview-format';
import { type OverviewPdfContent } from './overview-pdf';

export function OverviewExport({
  month,
  scope,
  content,
}: {
  month: string;
  scope: string;
  content: OverviewPdfContent;
}) {
  return (
    <FileDownload
      label="Exportar resumo em PDF"
      buttonContent={
        <>
          <Download aria-hidden="true" size={16} /> Exportar
        </>
      }
      download={async () => {
        const { overviewPdf } = await import('./overview-pdf');
        return {
          blob: await overviewPdf(scope, formatOverviewMonth(month), content),
          fileName: `cali-visao-geral-${month.slice(0, 7)}.pdf`,
        };
      }}
    />
  );
}
