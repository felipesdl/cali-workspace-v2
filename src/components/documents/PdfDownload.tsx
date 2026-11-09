import { FileDownload } from './FileDownload';

export function PdfDownload({
  download,
}: {
  download: (signal: AbortSignal) => Promise<{ blob: Blob; fileName: string }>;
}) {
  return <FileDownload download={download} label="Baixar PDF" />;
}
