import { useEffect, useState } from 'react';
import { getRouteApi, Link, useRouteContext } from '@tanstack/react-router';
import { isDriveCallbackState } from '../../../api/client/drive';
import { FeedbackState } from '../../../components/ds/feedback/FeedbackState';
import { FeedbackMessage } from '../../../components/ds/feedback/FeedbackMessage';
import { Panel } from '../../../components/ds/panel/Panel';

const route = getRouteApi('/oauth/google/callback');

export function GoogleDriveCallback() {
  const { code, state, error } = route.useSearch();
  const { clientDrive } = useRouteContext({ from: '__root__' });
  const [result, setResult] = useState<'done' | 'error' | null>(null);
  const drive = Boolean(state && isDriveCallbackState(state));
  const exchangeAvailable = Boolean(drive && clientDrive && code && !error);

  useEffect(() => {
    if (!exchangeAvailable || !clientDrive || !code || !state) return;
    let active = true;
    void clientDrive.exchange(code, state).then(
      () => {
        if (!active) return;
        setResult('done');
        window.history.replaceState(window.history.state, '', window.location.pathname);
      },
      () => {
        if (active) setResult('error');
      },
    );
    return () => {
      active = false;
    };
  }, [clientDrive, code, exchangeAvailable, state]);

  return (
    <main className="tw:mx-auto tw:grid tw:min-h-dvh tw:max-w-2xl tw:content-center tw:px-4">
      <Panel aria-labelledby="google-callback-title" className="tw:grid tw:gap-4">
        <h1 id="google-callback-title" className="tw:m-0 tw:text-section tw:text-brand">
          {drive ? 'Google Drive' : 'Conexão com Google'}
        </h1>
        {exchangeAvailable && result === null && (
          <FeedbackState kind="loading">Confirmando conexão…</FeedbackState>
        )}
        {result === 'done' && (
          <FeedbackMessage tone="success">Google Drive conectado.</FeedbackMessage>
        )}
        {(!exchangeAvailable || result === 'error') && (
          <FeedbackState kind="error">
            {drive
              ? 'Não foi possível confirmar a conexão. Volte aos documentos e tente novamente.'
              : 'Esta conexão não está disponível neste ambiente.'}
          </FeedbackState>
        )}
        {drive && (
          <Link
            to="/cliente/documentos"
            search={{ q: '', status: 'all', view: 'directory', page: 1 }}
            className="tw:text-brand tw:underline"
          >
            Voltar aos documentos
          </Link>
        )}
      </Panel>
    </main>
  );
}
