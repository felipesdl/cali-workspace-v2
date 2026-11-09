import { FeedbackMessage } from '../../components/ds/feedback/FeedbackMessage';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ds/button/Button';

export function FileDownload({
  download,
  label,
}: {
  label: string;
  download: (signal: AbortSignal) => Promise<{ blob: Blob; fileName: string }>;
}) {
  const pending = useRef<AbortController | null>(null);
  const restoreFocus = useRef(false);
  const button = useRef<HTMLButtonElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    if (busy || !restoreFocus.current) return;
    restoreFocus.current = false;
    const focused = document.activeElement;
    if (focused === document.body || focused === button.current) {
      (error ? feedback.current : button.current)?.focus();
    }
  }, [busy, error]);

  async function save() {
    if (pending.current) return;
    const request = new AbortController();
    pending.current = request;
    restoreFocus.current = true;
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
        setError(cause instanceof Error ? cause.message : 'Não foi possível baixar o arquivo.');
    } finally {
      pending.current = null;
      if (!request.signal.aborted) setBusy(false);
    }
  }

  return (
    <div className="tw:grid tw:min-w-0 tw:justify-items-start tw:gap-3 tw:wrap-anywhere">
      <Button ref={button} variant="secondary" pending={busy} onClick={() => void save()}>
        {busy ? 'Baixando…' : label}
      </Button>
      {error && (
        <FeedbackMessage
          ref={feedback}
          tone="error"
          tabIndex={-1}
          className="tw:justify-self-stretch"
        >
          {error}
        </FeedbackMessage>
      )}
    </div>
  );
}
