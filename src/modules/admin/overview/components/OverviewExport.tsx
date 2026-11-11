import { FileDownload } from '../../../../components/documents/FileDownload';
import { Download } from 'lucide-react';
import { formatOverviewMonth } from './overview-format';
import { type OverviewPdfContent } from './overview-pdf';
import { type SatisfactionRequests } from '../../../../api/admin/workspace/admin-read';

export function OverviewExport({
  month,
  scope,
  content,
  readSatisfaction,
}: {
  month: string;
  scope: string;
  content: OverviewPdfContent;
  readSatisfaction?: (signal: AbortSignal) => Promise<SatisfactionRequests | null>;
}) {
  return (
    <FileDownload
      label="Exportar resumo em PDF"
      buttonContent={
        <>
          <Download aria-hidden="true" size={16} /> Exportar
        </>
      }
      download={async (signal) => {
        const [{ overviewPdf }, requests] = await Promise.all([
          import('./overview-pdf'),
          readSatisfaction?.(signal),
        ]);
        const sections = requests
          ? [
              ...(content.sections ?? []),
              {
                title: 'Respostas às avaliações de ocorrências',
                rows: [
                  ['Respondidas', String(requests.answered)],
                  ['Aguardando resposta', String(requests.waiting)],
                  ['Sem resposta', String(requests.unanswered)],
                ] satisfies [string, string][],
              },
            ]
          : content.sections;
        return {
          blob: await overviewPdf(scope, formatOverviewMonth(month), { ...content, sections }),
          fileName: `cali-visao-geral-${month.slice(0, 7)}.pdf`,
        };
      }}
    />
  );
}
