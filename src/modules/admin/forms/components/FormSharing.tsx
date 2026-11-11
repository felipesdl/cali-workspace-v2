import { useEffect, useState } from 'react';
import { Button } from '../../../../components/ds/button/Button';
import { FeedbackMessage } from '../../../../components/ds/feedback/FeedbackMessage';
import { FileDownload } from '../../../../components/documents/FileDownload';

export function FormSharing({
  slug,
  title,
  preview,
}: {
  slug: string;
  title: string;
  preview?: { company: string; form: string };
}) {
  const previewUrl = new URL(`/f/${encodeURIComponent(slug)}`, window.location.origin);
  if (preview) {
    previewUrl.searchParams.set('previa', '1');
    previewUrl.searchParams.set('company', preview.company);
    previewUrl.searchParams.set('form', preview.form);
  }
  const url = new URL(`/f/${encodeURIComponent(slug)}`, window.location.origin).href;
  const [qr, setQr] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void import('./form-sharing')
      .then(({ qrDataUrl }) => qrDataUrl(url))
      .then((image) => {
        if (active) setQr(image);
      })
      .catch(() => {
        if (active) setError('Não foi possível preparar o QR Code.');
      });
    return () => {
      active = false;
    };
  }, [url]);

  return (
    <details className="tw:min-w-0 tw:rounded-control tw:border tw:border-border-default tw:p-4">
      <summary className="tw:cursor-pointer tw:font-semibold tw:text-brand">
        {preview ? 'Prévia do formulário' : 'Compartilhar formulário'}
      </summary>
      <div className="tw:mt-4 tw:grid tw:min-w-0 tw:gap-4 tw:wrap-anywhere">
        {preview && (
          <a
            href={previewUrl.href}
            target="_blank"
            rel="noopener noreferrer"
            className="tw:text-brand tw:underline"
          >
            Abrir prévia sem salvar respostas
          </a>
        )}
        {!preview && (
          <>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="tw:text-brand tw:underline"
            >
              {url}
            </a>
            <Button
              variant="secondary"
              onClick={() => {
                setMessage('');
                setError('');
                void Promise.resolve()
                  .then(() => navigator.clipboard?.writeText(url))
                  .then((result) => {
                    if (result === undefined) throw new Error('Clipboard unavailable');
                  })
                  .then(() => setMessage('Link copiado.'))
                  .catch(() => setError('Não foi possível copiar. Selecione o endereço acima.'));
              }}
            >
              Copiar link
            </Button>
            {qr && (
              <img
                src={qr}
                alt={`QR Code de ${title}`}
                width={180}
                height={180}
                className="tw:max-w-full"
              />
            )}
            <div className="tw:flex tw:flex-wrap tw:gap-3">
              <FileDownload
                label="Baixar QR Code"
                download={async () => {
                  const { qrDataUrl } = await import('./form-sharing');
                  const data = await qrDataUrl(url, 1024);
                  return { blob: await (await fetch(data)).blob(), fileName: `${slug}-qrcode.png` };
                }}
              />
              <FileDownload
                label="Baixar cartão de divulgação"
                download={async () => {
                  const { shareCard } = await import('./form-sharing');
                  return {
                    blob: await shareCard({ title, category: 'CALI Forms', intro: '' }, url),
                    fileName: `${slug}-cartao.png`,
                  };
                }}
              />
            </div>
          </>
        )}
        {message && <FeedbackMessage tone="success">{message}</FeedbackMessage>}
        {error && <FeedbackMessage tone="error">{error}</FeedbackMessage>}
      </div>
    </details>
  );
}
