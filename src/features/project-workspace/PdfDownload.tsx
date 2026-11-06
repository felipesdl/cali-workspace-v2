import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ds/button/Button';

export function PdfDownload({
  download,
}: {
  download: (signal: AbortSignal) => Promise<{ blob: Blob; fileName: string }>;
}) {
  const pending = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => () => pending.current?.abort(), []);

  async function save() {
    if (pending.current) return;
    const request = new AbortController();
    pending.current = request;
    setBusy(true);
    setError('');
    try {
      const result = await download(request.signal);
      if (request.signal.aborted) return;
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.fileName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      if (!request.signal.aborted)
        setError(cause instanceof Error ? cause.message : 'Não foi possível baixar o PDF.');
    } finally {
      pending.current = null;
      if (!request.signal.aborted) setBusy(false);
    }
  }

  return (
    <div>
      <Button variant="secondary" disabled={busy} onClick={() => void save()}>
        {busy ? 'Baixando…' : 'Baixar PDF'}
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
